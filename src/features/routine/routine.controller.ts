import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateRoutineLogParams, CreateRoutineTemplateParams, GetRoutineAnalyticsQuery, GetRoutineLogsQuery, GetRoutineStatsQuery, ReorderRoutinesParams, UpdateRoutineLogParams, UpdateRoutineTemplateParams, UpdateUserRoutinePreferencesParams, } from './routine.interfaces';
import routineService from './routine.service';

export class RoutineController {
    // ============================================
    // ROUTINE TEMPLATE ENDPOINTS
    // ============================================

    /**
     * Create a new routine template
     * POST /api/routines
     */
    static async createRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: CreateRoutineTemplateParams = req.body;

            const routine = await routineService.createRoutineTemplate(userId, params);

            ResponseHelper.created(res, routine, 'Routine created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create routine', 500, error);
        }
    }

    /**
     * Get all routine templates for user
     * GET /api/routines?status=active|paused|archived
     */
    static async getRoutineTemplates(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { status } = req.query;

            const routines = await routineService.getRoutineTemplates(
                userId,
                status as string | undefined
            );

            ResponseHelper.success(res, routines, 'Routines retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve routines', 500, error);
        }
    }

    /**
     * Get single routine template by ID
     * GET /api/routines/:id
     */
    static async getRoutineTemplateById(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.getRoutineTemplateById(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve routine', 500, error);
        }
    }

    /**
     * Update routine template
     * PATCH /api/routines/:id
     */
    static async updateRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateRoutineTemplateParams = req.body;

            const routine = await routineService.updateRoutineTemplate(userId, id, params);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update routine', 500, error);
        }
    }

    /**
     * Pause routine template
     * PATCH /api/routines/:id/pause
     */
    static async pauseRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.pauseRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine paused successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to pause routine', 500, error);
        }
    }

    /**
     * Archive routine template
     * PATCH /api/routines/:id/archive
     */
    static async archiveRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.archiveRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine archived successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to archive routine', 500, error);
        }
    }

    /**
     * Unarchive routine template
     * PATCH /api/routines/:id/unarchive
     */
    static async unarchiveRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.unarchiveRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine unarchived successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to unarchive routine', 500, error);
        }
    }

    /**
     * Delete routine template
     * DELETE /api/routines/:id
     */
    static async deleteRoutineTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const deleted = await routineService.deleteRoutineTemplate(userId, id);

            if (!deleted) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, null, 'Routine deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete routine', 500, error);
        }
    }

    /**
     * Reorder routine templates
     * PATCH /api/routines/reorder
     */
    static async reorderRoutineTemplates(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { routineIds }: ReorderRoutinesParams = req.body;

            await routineService.reorderRoutineTemplates(userId, routineIds);

            ResponseHelper.success(res, null, 'Routines reordered successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to reorder routines', 500, error);
        }
    }

    // ============================================
    // ROUTINE LOG ENDPOINTS
    // ============================================

    /**
     * Create or update routine log
     * POST /api/routine-logs
     */
    static async createOrUpdateRoutineLog(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: CreateRoutineLogParams = req.body;

            const log = await routineService.createOrUpdateRoutineLog(userId, params);
            ResponseHelper.created(res, log, 'Routine log saved successfully');
        } catch (error: any) {
            if (error.message === 'Routine not found') {
                ResponseHelper.notFound(res, error.message);
                return;
            }
            ResponseHelper.error(res, 'Failed to save routine log', 500, error);
        }
    }

    /**
     * Get routine logs
     * GET /api/routine-logs?date=YYYY-MM-DD&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&routineId=xxx
     */
    static async getRoutineLogs(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const query: GetRoutineLogsQuery = {
                ...req.query,
                timezoneOffset: req.query.timezoneOffset ? Number(req.query.timezoneOffset) : undefined
            };

            const logs = await routineService.getRoutineLogs(userId, query);

            ResponseHelper.success(res, logs, 'Routine logs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve routine logs', 500, error);
        }
    }

    /**
     * Update routine log
     * PATCH /api/routine-logs/:id
     */
    static async updateRoutineLog(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateRoutineLogParams = req.body;

            const log = await routineService.updateRoutineLog(userId, id, params);

            if (!log) {
                ResponseHelper.notFound(res, 'Routine log not found');
                return;
            }

            ResponseHelper.success(res, log, 'Routine log updated successfully');
        } catch (error: any) {
            if (error.message === 'Routine not found') {
                ResponseHelper.notFound(res, error.message);
                return;
            }
            ResponseHelper.error(res, 'Failed to update routine log', 500, error);
        }
    }

    /**
     * Delete routine log
     * DELETE /api/routine-logs/:id
     */
    static async deleteRoutineLog(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const deleted = await routineService.deleteRoutineLog(userId, id);

            if (!deleted) {
                ResponseHelper.notFound(res, 'Routine log not found');
                return;
            }

            ResponseHelper.success(res, null, 'Routine log deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete routine log', 500, error);
        }
    }

    // ============================================
    // ANALYTICS ENDPOINTS
    // ============================================

    /**
     * Get routine statistics
     * GET /api/routines/:id/stats?period=week|month|year|all
     */
    static async getRoutineStats(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const query: GetRoutineStatsQuery = req.query;

            const stats = await routineService.getRoutineStats(userId, id, query);
            ResponseHelper.success(res, stats, 'Routine statistics retrieved successfully');
        } catch (error: any) {
            if (error.message === 'Routine not found') {
                ResponseHelper.notFound(res, error.message);
                return;
            }
            ResponseHelper.error(res, 'Failed to retrieve routine stats', 500, error);
        }
    }

    /**
     * Get overall routine analytics
     * GET /api/routines/analytics?period=week|month|year
     */
    static async getRoutineAnalytics(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const query: GetRoutineAnalyticsQuery = req.query;

            const analytics = await routineService.getRoutineAnalytics(userId, query);

            ResponseHelper.success(res, analytics, 'Routine analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve routine analytics', 500, error);
        }
    }

    // ============================================
    // USER PREFERENCES ENDPOINTS
    // ============================================

    /**
     * Get user routine preferences
     * GET /api/routine-preferences
     */
    static async getUserRoutinePreferences(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();

            const preferences = await routineService.getUserRoutinePreferences(userId);

            ResponseHelper.success(res, preferences, 'Preferences retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve preferences', 500, error);
        }
    }

    /**
     * Update user routine preferences
     * PATCH /api/routine-preferences
     */
    static async updateUserRoutinePreferences(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: UpdateUserRoutinePreferencesParams = req.body;

            const preferences = await routineService.updateUserRoutinePreferences(
                userId,
                params
            );

            ResponseHelper.success(res, preferences, 'Preferences updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update preferences', 500, error);
        }
    }
}

export default RoutineController;
