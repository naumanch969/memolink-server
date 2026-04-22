import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { User } from '../auth/auth.model';
import { emailService } from '../email/email.service';
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
        return true;
    }

    async getDeliveryLogs(announcementId: string, page: number = 1, limit: number = 50) {
        const result = await emailService.getLogsByMetadata('announcementId', announcementId, page, limit);
        return {
            logs: result.data,
            total: result.total
        };
    }

    async dispatchAnnouncement(id: string): Promise<IAnnouncement | null> {
        const announcement = await Announcement.findById(id);
        if (!announcement) return null;

        if (announcement.status === AnnouncementStatus.PROCESSING || announcement.status === AnnouncementStatus.COMPLETED) {
            throw new Error('Announcement is already being processed or completed');
        }

        // Run processing in background
        this.processDispatch(announcement).catch(err => {
            logger.error(`Background dispatch failed for ${id}:`, err);
        });

        return announcement;
    }

    /**
     * Unified dispatch logic using EmailService.sendBulkEmails
     */
    private async processDispatch(announcement: IAnnouncement) {
        try {
            logger.info(`Starting dispatch for announcement ${announcement._id}`);

            // 1. Build recipient list
            const query: any = { isEmailVerified: true };

            if (announcement.target.roles && announcement.target.roles.length > 0 && !announcement.target.roles.includes('all')) {
                query.role = { $in: announcement.target.roles };
            }

            if (announcement.type === AnnouncementType.NEWSLETTER) {
                query['preferences.communication.newsletter'] = { $ne: false };
            } else if (announcement.type === AnnouncementType.ANNOUNCEMENT) {
                query['preferences.communication.productUpdates'] = { $ne: false };
            }

            const users = await User.find(query).select('email _id').lean();
            const recipients = users.map(u => ({
                to: u.email,
                userId: (u as any)._id.toString()
            }));

            if (recipients.length === 0) {
                logger.info(`No recipients found for announcement ${announcement._id}`);
                announcement.status = AnnouncementStatus.COMPLETED;
                announcement.stats.totalRecipients = 0;
                announcement.stats.progress = 100;
                await announcement.save();
                return;
            }

            // 2. Prepare content
            const sanitizedHtml = DOMPurify.sanitize(announcement.content);
            const textContent = announcement.content.replace(/<[^>]*>?/gm, '');

            // 3. Mark as processing
            announcement.status = AnnouncementStatus.PROCESSING;
            announcement.sentAt = new Date();
            await announcement.save();

            // 4. Send Bulk Emails via Unified Email Engine
            const queuedCount = await emailService.sendBulkEmails(
                recipients,
                announcement.title,
                sanitizedHtml,
                textContent,
                { announcementId: announcement._id.toString() }
            );

            // 5. Update finale stats
            announcement.stats.totalRecipients = recipients.length;
            announcement.stats.queuedCount = queuedCount;
            announcement.stats.invalidEmailCount = recipients.length - queuedCount;
            announcement.stats.progress = 100;
            announcement.status = AnnouncementStatus.COMPLETED;
            await announcement.save();

            socketService.emitAll(SocketEvents.ANNOUNCEMENT_UPDATED, announcement);
            logger.info(`Completed dispatch for announcement ${announcement._id}. Queued: ${queuedCount}`);

        } catch (error) {
            logger.error(`Error in processDispatch for ${announcement._id}:`, error);
            announcement.status = AnnouncementStatus.FAILED;
            await announcement.save();
        }
    }
}

export const announcementService = new AnnouncementService();
