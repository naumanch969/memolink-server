import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { announcementService } from './announcement.service';

export class AnnouncementController {

    async create(req: Request, res: Response) {
        try {
            if (!req.user) return ResponseHelper.unauthorized(res);

            const announcement = await announcementService.createAnnouncement({
                ...req.body,
                authorId: req.user._id.toString()
            });

            ResponseHelper.created(res, announcement, 'Announcement created successfully');
        } catch (error: any) {
            logger.error('Error creating announcement:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const { data, total } = await announcementService.getAnnouncements(page, limit);

            ResponseHelper.paginated(res, data, {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }, 'Announcements retrieved successfully');
        } catch (error: any) {
            logger.error('Error getting announcements:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    async getOne(req: Request, res: Response) {
        try {
            const announcement = await announcementService.getAnnouncementById(req.params.id);
            if (!announcement) {
                return ResponseHelper.notFound(res, 'Announcement not found');
            }

            ResponseHelper.success(res, announcement);
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    async update(req: Request, res: Response) {
        try {
            const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
            if (!announcement) {
                return ResponseHelper.notFound(res, 'Announcement not found');
            }

            ResponseHelper.success(res, announcement, 'Announcement updated successfully');
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const success = await announcementService.deleteAnnouncement(req.params.id);
            if (!success) {
                return ResponseHelper.notFound(res, 'Announcement not found or cannot be deleted');
            }

            ResponseHelper.success(res, null, 'Announcement deleted successfully');
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    async send(req: Request, res: Response) {
        try {
            const announcement = await announcementService.dispatchAnnouncement(req.params.id);
            ResponseHelper.success(res, announcement, 'Announcement dispatch started');
        } catch (error: any) {
            logger.error('Error sending announcement:', error);
            ResponseHelper.badRequest(res, error.message);
        }
    }
}

export const announcementController = new AnnouncementController();
