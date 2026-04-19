
import { Request, Response } from 'express';
import { badgeService } from './badge.service';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';

export class BadgeController {
    /**
     * Get badges for the authenticated user
     */
    static async getMyBadges(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user!._id.toString();
            const badges = await badgeService.getUserBadges(userId);
            ResponseHelper.success(res, badges);
        } catch (error: any) {
            logger.error('Error fetching user badges:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Get all enabled badge definitions
     */
    static async getAvailableBadges(req: Request, res: Response): Promise<void> {
        try {
            const badges = await badgeService.getAvailableBadges();
            ResponseHelper.success(res, badges);
        } catch (error: any) {
            logger.error('Error fetching available badges:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Award a badge to a specific user (Admin only)
     */
    static async awardBadge(req: Request, res: Response): Promise<void> {
        try {
            const { userId, badgeId, metadata } = req.body;

            if (!userId || !badgeId) {
                ResponseHelper.badRequest(res, 'userId and badgeId are required');
                return;
            }

            const awardedBadge = await badgeService.awardBadge(userId, badgeId, metadata);
            ResponseHelper.success(res, awardedBadge, 'Badge awarded successfully');
        } catch (error: any) {
            logger.error('Error awarding badge:', error);
            ResponseHelper.error(res, error.message);
        }
    }
}
