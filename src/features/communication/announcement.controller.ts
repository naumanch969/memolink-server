import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ApiResponse } from '../../shared/types';
import { announcementService } from './announcement.service';

export class AnnouncementController {

    async create(req: Request, res: Response) {
        try {
            if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

            // TODO: Add stricter validation/Zod here
            const announcement = await announcementService.createAnnouncement({
                ...req.body,
                authorId: req.user._id.toString()
            });

            const response: ApiResponse = {
                success: true,
                message: 'Announcement created successfully',
                data: announcement
            };
            res.status(201).json(response);
        } catch (error: any) {
            logger.error('Error creating announcement:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const { data, total } = await announcementService.getAnnouncements(page, limit);

            const response: ApiResponse = {
                success: true,
                message: 'Announcements retrieved successfully',
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
            res.json(response);
        } catch (error: any) {
            logger.error('Error getting announcements:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getOne(req: Request, res: Response) {
        try {
            const announcement = await announcementService.getAnnouncementById(req.params.id);
            if (!announcement) {
                return res.status(404).json({ success: false, message: 'Announcement not found' });
            }

            res.json({
                success: true,
                data: announcement
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
            if (!announcement) {
                return res.status(404).json({ success: false, message: 'Announcement not found' });
            }

            res.json({
                success: true,
                message: 'Announcement updated successfully',
                data: announcement
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const success = await announcementService.deleteAnnouncement(req.params.id);
            if (!success) {
                return res.status(404).json({ success: false, message: 'Announcement not found or cannot be deleted' });
            }

            res.json({
                success: true,
                message: 'Announcement deleted successfully'
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async send(req: Request, res: Response) {
        try {
            const announcement = await announcementService.dispatchAnnouncement(req.params.id);
            res.json({
                success: true,
                message: 'Announcement dispatch started',
                data: announcement
            });
        } catch (error: any) {
            logger.error('Error sending announcement:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

export const announcementController = new AnnouncementController();
