import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { USER_ROLES } from '../../shared/constants';
import { validateEmailOrThrow } from '../../shared/email-validator';
import { User } from '../auth/auth.model';
import { getEmailQueue } from '../email/queue/email.queue';
import { AnnouncementDeliveryLog, DeliveryStatus } from './announcement-delivery-log.model';
import { IAnnouncementService } from "./announcement.interfaces";
import { Announcement, AnnouncementStatus, AnnouncementType, IAnnouncement } from './announcement.model';
import { CreateAnnouncementDto } from './announcement.types';

export class AnnouncementService implements IAnnouncementService {

    async createAnnouncement(data: CreateAnnouncementDto): Promise<IAnnouncement> {
        const announcement = new Announcement({
            ...data,
            status: data.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
        });
        return announcement.save();
    }

    async getAnnouncements(page: number = 1, limit: number = 10): Promise<{ data: IAnnouncement[]; total: number }> {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            Announcement.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
            Announcement.countDocuments(),
        ]);
        return { data, total };
    }

    async getAnnouncementById(id: string): Promise<IAnnouncement | null> {
        return Announcement.findById(id);
    }

    async updateAnnouncement(id: string, updates: Partial<CreateAnnouncementDto>): Promise<IAnnouncement | null> {
        const announcement = await Announcement.findById(id);
        if (!announcement) return null;

        if (announcement.status === AnnouncementStatus.PROCESSING || announcement.status === AnnouncementStatus.COMPLETED) {
            throw new Error('Cannot update an announcement that has already been processed');
        }

        Object.assign(announcement, updates);
        if (updates.scheduledAt) {
            announcement.status = AnnouncementStatus.SCHEDULED;
        }

        return announcement.save();
    }

    async deleteAnnouncement(id: string): Promise<boolean> {
        const announcement = await Announcement.findById(id);
        if (!announcement || announcement.status === AnnouncementStatus.PROCESSING) {
            return false;
        }

        await Announcement.findByIdAndDelete(id);
        // Also clean up delivery logs
        await AnnouncementDeliveryLog.deleteMany({ announcementId: id });
        return true;
    }

    async getDeliveryLogs(announcementId: string, page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AnnouncementDeliveryLog.find({ announcementId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AnnouncementDeliveryLog.countDocuments({ announcementId })
        ]);

        return { logs, total };
    }

    /**
     * Dispatch an announcement to the email queue.
     * This fetches eligible users and creates a job for each.
     */
    async dispatchAnnouncement(id: string): Promise<IAnnouncement | null> {
        const announcement = await Announcement.findById(id);
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        if (announcement.status === AnnouncementStatus.PROCESSING || announcement.status === AnnouncementStatus.COMPLETED) {
            throw new Error('Announcement is already processed or processing');
        }

        announcement.status = AnnouncementStatus.PROCESSING;
        await announcement.save();

        // Start async processing without blocking the request
        this.processDispatch(announcement).catch(err => {
            logger.error(`Failed to process announcement dispatch ${id}:`, err);
            announcement.status = AnnouncementStatus.FAILED;
            announcement.save();
        });

        return announcement;
    }

    private async processDispatch(announcement: IAnnouncement) {
        try {
            logger.info(`Starting dispatch for announcement ${announcement._id}`);

            // Build query based on target
            const query: any = { isEmailVerified: true };

            // Filter by roles if specified, handle 'all' by skipping filter
            if (announcement.target.roles && announcement.target.roles.length > 0 && !announcement.target.roles.includes('all')) {
                query.role = { $in: announcement.target.roles };
            }

            // Filter by user preferences based on announcement type
            if (announcement.type === AnnouncementType.NEWSLETTER) {
                // Explicitly check for false, as undefined (legacy users) should default to true handled by code/schema defaults if possible,
                // but robustly: query where it's NOT false.
                query['preferences.communication.newsletter'] = { $ne: false };
            } else if (announcement.type === AnnouncementType.ANNOUNCEMENT) {
                query['preferences.communication.productUpdates'] = { $ne: false };
            }
            // Security alerts usually bypass preference checks or have a separate strictly enforced flag

            // Use cursor to handle large user bases efficiently
            const cursor = User.find(query).select('email name').cursor();
            const emailQueue = getEmailQueue();

            let queuedCount = 0;
            let invalidEmailCount = 0;
            const batchSize = 100;
            let batch: any[] = [];
            let deliveryLogs: any[] = [];

            // Sanitize HTML content once before batching
            const sanitizedHtml = DOMPurify.sanitize(announcement.content);
            const textContent = announcement.content.replace(/<[^>]*>?/gm, ''); // Simple strip tags for text version

            for (let user = await cursor.next(); user != null; user = await cursor.next()) {
                // Validate email before adding to batch
                try {
                    validateEmailOrThrow(user.email, 'announcement');

                    batch.push({
                        name: `announcement-${announcement._id}-${user._id}`,
                        data: {
                            type: 'GENERIC',
                            data: {
                                to: user.email,
                                subject: announcement.title,
                                html: sanitizedHtml,
                                text: textContent,
                            }
                        },
                        opts: {
                            jobId: `announcement-${announcement._id}-${user._id}`
                        }
                    });

                    // Create delivery log entry
                    deliveryLogs.push({
                        announcementId: announcement._id,
                        userId: user._id,
                        recipientEmail: user.email,
                        recipientName: user.name,
                        status: DeliveryStatus.QUEUED,
                        attempts: 0,
                    });
                } catch (error) {
                    invalidEmailCount++;
                    logger.warn(`Skipping invalid email for user ${user._id}:`, { email: user.email });
                    continue;
                }

                if (batch.length >= batchSize) {
                    await emailQueue.addBulk(batch);
                    await AnnouncementDeliveryLog.insertMany(deliveryLogs);
                    queuedCount += batch.length;
                    batch = [];
                    deliveryLogs = [];

                    // Update progress periodically
                    announcement.stats.queuedCount = queuedCount;
                    announcement.stats.invalidEmailCount = invalidEmailCount;
                    await announcement.save();

                    // Emit socket event for progress
                    socketService.emitToRole(USER_ROLES.ADMIN, SocketEvents.ANNOUNCEMENT_DISPATCH_PROGRESS, {
                        announcementId: announcement._id,
                        stats: announcement.stats
                    });
                }
            }

            // Add remaining items in batch
            if (batch.length > 0) {
                await emailQueue.addBulk(batch);
                await AnnouncementDeliveryLog.insertMany(deliveryLogs);
                queuedCount += batch.length;
            }

            announcement.stats.totalRecipients = queuedCount + invalidEmailCount;
            announcement.stats.queuedCount = queuedCount;
            announcement.stats.invalidEmailCount = invalidEmailCount;

            // If no recipients, mark as COMPLETED immediately
            if (queuedCount === 0) {
                announcement.status = AnnouncementStatus.COMPLETED;
                announcement.stats.progress = 100;
            } else {
                // Keep as PROCESSING, worker will complete it
                announcement.status = AnnouncementStatus.PROCESSING;
                announcement.stats.progress = 0;
            }

            announcement.sentAt = new Date();
            await announcement.save();

            // Emit socket event for update
            socketService.emitAll(SocketEvents.ANNOUNCEMENT_UPDATED, announcement);

            logger.info(`Completed dispatch for announcement ${announcement._id}.`);

        } catch (error) {
            logger.error(`Error in processDispatch for ${announcement._id}:`, error);
            announcement.status = AnnouncementStatus.FAILED;
            await announcement.save();
        }
    }
}

export const announcementService = new AnnouncementService();
