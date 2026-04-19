
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

    /**
     * Seed badge definitions (Admin only)
     */
    static async seedBadges(req: Request, res: Response): Promise<void> {
        try {
            await badgeService.seedBadges();
            ResponseHelper.success(res, null, 'Badge definitions seeded successfully');
        } catch (error: any) {
            logger.error('Error seeding badges:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Get all badges for administration
     */
    static async getAllBadgesAdmin(req: Request, res: Response): Promise<void> {
        try {
            const badges = await badgeService.getAllBadgesAdmin();
            ResponseHelper.success(res, badges);
        } catch (error: any) {
            logger.error('Error fetching all badges for admin:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Create a new badge definition
     */
    static async createBadge(req: Request, res: Response): Promise<void> {
        try {
            const badge = await badgeService.createBadge(req.body);
            ResponseHelper.success(res, badge, 'Badge created successfully', 201);
        } catch (error: any) {
            logger.error('Error creating badge:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Update an existing badge definition
     */
    static async updateBadge(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const badge = await badgeService.updateBadge(id, req.body);
            if (!badge) {
                ResponseHelper.notFound(res, 'Badge not found');
                return;
            }
            ResponseHelper.success(res, badge, 'Badge updated successfully');
        } catch (error: any) {
            logger.error('Error updating badge:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Delete a badge definition
     */
    static async deleteBadge(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const deleted = await badgeService.deleteBadge(id);
            if (!deleted) {
                ResponseHelper.notFound(res, 'Badge not found');
                return;
            }
            ResponseHelper.success(res, null, 'Badge deleted successfully');
        } catch (error: any) {
            logger.error('Error deleting badge:', error);
            ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Get badge achievement statistics
     */
    static async getBadgeStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await badgeService.getBadgeStats();
            ResponseHelper.success(res, stats);
        } catch (error: any) {
            logger.error('Error fetching badge stats:', error);
            ResponseHelper.error(res, error.message);
        }
    }
}
