import { Response } from 'express';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { webActivityService } from './web-activity.service';

export class WebActivityController {
    /**
     * POST /api/activity/sync
     */
    static async sync(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const batch = req.body;

            if (!batch.date || typeof batch.totalSeconds !== 'number') {
                ResponseHelper.badRequest(res, 'Invalid activity batch data');
                return;
            }

            const activity = await webActivityService.syncActivity(userId, batch);

            // Broadcast update
            socketService.emitToUser(userId, SocketEvents.WEB_ACTIVITY_UPDATED, activity);

            ResponseHelper.success(res, activity, 'Activity synced successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/today
     */
    static async getToday(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const date = req.query.date as string || new Date().toISOString().split('T')[0];
            const activity = await webActivityService.getTodayStats(userId, date);

            ResponseHelper.success(res, activity, 'Activity retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/range?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    static async getRange(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { from, to } = req.query;

            if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
                ResponseHelper.badRequest(res, 'from and to dates are required (YYYY-MM-DD)');
                return;
            }

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(from) || !dateRegex.test(to)) {
                ResponseHelper.badRequest(res, 'Invalid date format. Use YYYY-MM-DD');
                return;
            }

            const activities = await webActivityService.getActivityRange(userId, from, to);
            ResponseHelper.success(res, activities, 'Activity range retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/weekly?date=YYYY-MM-DD
     */
    static async getWeekly(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const date = req.query.date as string || new Date().toISOString().split('T')[0];

            const summary = await webActivityService.getWeeklySummary(userId, date);
            ResponseHelper.success(res, summary, 'Weekly summary retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/monthly?year=2026&month=2
     */
    static async getMonthly(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

            if (month < 1 || month > 12) {
                ResponseHelper.badRequest(res, 'Month must be between 1 and 12');
                return;
            }

            const summary = await webActivityService.getMonthlySummary(userId, year, month);
            ResponseHelper.success(res, summary, 'Monthly summary retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/definitions
     */
    static async getDefinitions(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const definitions = await webActivityService.getDefinitions(userId);
            ResponseHelper.success(res, definitions, 'Definitions retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * POST /api/activity/definitions
     */
    static async updateDefinitions(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const definitions = await webActivityService.updateDefinitions(userId, req.body);
            ResponseHelper.success(res, definitions, 'Definitions updated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * PUT /api/activity/limits
     * Add or update a domain limit
     */
    static async upsertLimit(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { domain, dailyLimitMinutes, action, enabled } = req.body;

            if (!domain || typeof dailyLimitMinutes !== 'number' || dailyLimitMinutes < 1) {
                ResponseHelper.badRequest(res, 'domain and dailyLimitMinutes (>= 1) are required');
                return;
            }

            if (action && !['nudge', 'block'].includes(action)) {
                ResponseHelper.badRequest(res, 'action must be "nudge" or "block"');
                return;
            }

            const definitions = await webActivityService.upsertDomainLimit(userId, {
                domain,
                dailyLimitMinutes,
                action: action || 'nudge',
                enabled: enabled !== undefined ? enabled : true
            });
            ResponseHelper.success(res, definitions, 'Domain limit saved');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * DELETE /api/activity/limits/:domain
     */
    static async removeLimit(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const domain = decodeURIComponent(req.params.domain);

            if (!domain) {
                ResponseHelper.badRequest(res, 'domain parameter is required');
                return;
            }

            const definitions = await webActivityService.removeDomainLimit(userId, domain);
            ResponseHelper.success(res, definitions, 'Domain limit removed');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/limits/check?date=YYYY-MM-DD
     * Check current usage against limits
     */
    static async checkLimits(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const date = req.query.date as string;

            const result = await webActivityService.checkLimits(userId, date);
            ResponseHelper.success(res, result, 'Limits checked successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }
}
