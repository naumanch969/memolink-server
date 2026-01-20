import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { emailQueue } from '../email/queue/email.queue';
import { Announcement, AnnouncementStatus, AnnouncementType, IAnnouncement } from './announcement.model';

interface CreateAnnouncementDto {
    title: string;
    content: string;
    type: AnnouncementType;
    target?: {
        roles?: string[];
    };
    scheduledAt?: Date;
    authorId: string;
}

export class AnnouncementService {

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
        const result = await Announcement.deleteOne({
            _id: id,
            status: { $in: [AnnouncementStatus.DRAFT, AnnouncementStatus.SCHEDULED] }
        });
        return result.deletedCount === 1;
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

            // Filter by roles if specified
            if (announcement.target.roles && announcement.target.roles.length > 0) {
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

            let count = 0;

            for (let user = await cursor.next(); user != null; user = await cursor.next()) {
                await emailQueue.add(`announcement-${announcement._id}-${user._id}`, {
                    type: 'GENERIC',
                    data: {
                        to: user.email,
                        subject: announcement.title,
                        html: announcement.content,
                        text: announcement.content.replace(/<[^>]*>?/gm, ''), // Simple strip tags for text version
                    }
                }, {
                    // Optional: Job ID deduplication
                    jobId: `announcement-${announcement._id}-${user._id}`
                });
                count++;
            }

            announcement.stats.totalRecipients = count;
            announcement.stats.sentCount = count; // Technically "queued" count, real sent count would be tracked via callbacks/webhooks in a more complex system
            announcement.status = AnnouncementStatus.COMPLETED;
            announcement.sentAt = new Date();
            await announcement.save();

            logger.info(`Completed dispatch for announcement ${announcement._id}. Queued ${count} emails.`);

        } catch (error) {
            logger.error(`Error in processDispatch for ${announcement._id}:`, error);
            announcement.status = AnnouncementStatus.FAILED;
            await announcement.save();
        }
    }
}

export const announcementService = new AnnouncementService();
