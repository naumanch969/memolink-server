import { Response, NextFunction } from 'express';
import routineService from './routine.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateRoutineTemplateParams, UpdateRoutineTemplateParams, CreateRoutineLogParams, UpdateRoutineLogParams, GetRoutineLogsQuery, GetRoutineStatsQuery, GetRoutineAnalyticsQuery, UpdateUserRoutinePreferencesParams, ReorderRoutinesParams, } from './routine.interfaces';

export class RoutineController {
    // ============================================
    // ROUTINE TEMPLATE ENDPOINTS
    // ============================================

    /**
     * Create a new routine template
     * POST /api/routines
     */
    static createRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const params: CreateRoutineTemplateParams = req.body;

            const routine = await routineService.createRoutineTemplate(userId, params);

            ResponseHelper.created(res, routine, 'Routine created successfully');
        }
    );

    /**
     * Get all routine templates for user
     * GET /api/routines?status=active|paused|archived
     */
    static getRoutineTemplates = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { status } = req.query;

            const routines = await routineService.getRoutineTemplates(
                userId,
                status as string | undefined
            );

            ResponseHelper.success(res, routines, 'Routines retrieved successfully');
        }
    );

    /**
     * Get single routine template by ID
     * GET /api/routines/:id
     */
    static getRoutineTemplateById = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.getRoutineTemplateById(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine retrieved successfully');
        }
    );

    /**
     * Update routine template
     * PATCH /api/routines/:id
     */
    static updateRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateRoutineTemplateParams = req.body;

            const routine = await routineService.updateRoutineTemplate(userId, id, params);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine updated successfully');
        }
    );

    /**
     * Pause routine template
     * PATCH /api/routines/:id/pause
     */
    static pauseRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.pauseRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine paused successfully');
        }
    );

    /**
     * Archive routine template
     * PATCH /api/routines/:id/archive
     */
    static archiveRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.archiveRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine archived successfully');
        }
    );

    /**
     * Unarchive routine template
     * PATCH /api/routines/:id/unarchive
     */
    static unarchiveRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const routine = await routineService.unarchiveRoutineTemplate(userId, id);

            if (!routine) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, routine, 'Routine unarchived successfully');
        }
    );

    /**
     * Delete routine template
     * DELETE /api/routines/:id
     */
    static deleteRoutineTemplate = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const deleted = await routineService.deleteRoutineTemplate(userId, id);

            if (!deleted) {
                ResponseHelper.notFound(res, 'Routine not found');
                return;
            }

            ResponseHelper.success(res, null, 'Routine deleted successfully');
        }
    );

    /**
     * Reorder routine templates
     * PATCH /api/routines/reorder
     */
    static reorderRoutineTemplates = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { routineIds }: ReorderRoutinesParams = req.body;

            await routineService.reorderRoutineTemplates(userId, routineIds);

            ResponseHelper.success(res, null, 'Routines reordered successfully');
        }
    );

    // ============================================
    // ROUTINE LOG ENDPOINTS
    // ============================================

    /**
     * Create or update routine log
     * POST /api/routine-logs
     */
    static createOrUpdateRoutineLog = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const params: CreateRoutineLogParams = req.body;

            try {
                const log = await routineService.createOrUpdateRoutineLog(userId, params);
                ResponseHelper.created(res, log, 'Routine log saved successfully');
            } catch (error: any) {
                if (error.message === 'Routine not found') {
                    ResponseHelper.notFound(res, error.message);
                    return;
                }
                throw error;
            }
        }
    );

    /**
     * Get routine logs
     * GET /api/routine-logs?date=YYYY-MM-DD&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&routineId=xxx
     */
    static getRoutineLogs = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const query: GetRoutineLogsQuery = {
                ...req.query,
                timezoneOffset: req.query.timezoneOffset ? Number(req.query.timezoneOffset) : undefined
            };

            const logs = await routineService.getRoutineLogs(userId, query);

            ResponseHelper.success(res, logs, 'Routine logs retrieved successfully');
        }
    );

    /**
     * Update routine log
     * PATCH /api/routine-logs/:id
     */
    static updateRoutineLog = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateRoutineLogParams = req.body;

            try {
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
                throw error;
            }
        }
    );

    /**
     * Delete routine log
     * DELETE /api/routine-logs/:id
     */
    static deleteRoutineLog = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const deleted = await routineService.deleteRoutineLog(userId, id);

            if (!deleted) {
                ResponseHelper.notFound(res, 'Routine log not found');
                return;
            }

            ResponseHelper.success(res, null, 'Routine log deleted successfully');
        }
    );

    // ============================================
    // ANALYTICS ENDPOINTS
    // ============================================

    /**
     * Get routine statistics
     * GET /api/routines/:id/stats?period=week|month|year|all
     */
    static getRoutineStats = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const query: GetRoutineStatsQuery = req.query;

            try {
                const stats = await routineService.getRoutineStats(userId, id, query);
                ResponseHelper.success(res, stats, 'Routine statistics retrieved successfully');
            } catch (error: any) {
                if (error.message === 'Routine not found') {
                    ResponseHelper.notFound(res, error.message);
                    return;
                }
                throw error;
            }
        }
    );

    /**
     * Get overall routine analytics
     * GET /api/routines/analytics?period=week|month|year
     */
    static getRoutineAnalytics = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const query: GetRoutineAnalyticsQuery = req.query;

            const analytics = await routineService.getRoutineAnalytics(userId, query);

            ResponseHelper.success(res, analytics, 'Routine analytics retrieved successfully');
        }
    );

    // ============================================
    // USER PREFERENCES ENDPOINTS
    // ============================================

    /**
     * Get user routine preferences
     * GET /api/routine-preferences
     */
    static getUserRoutinePreferences = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();

            const preferences = await routineService.getUserRoutinePreferences(userId);

            ResponseHelper.success(res, preferences, 'Preferences retrieved successfully');
        }
    );

    /**
     * Update user routine preferences
     * PATCH /api/routine-preferences
     */
    static updateUserRoutinePreferences = asyncHandler(
        async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            const userId = req.user!._id.toString();
            const params: UpdateUserRoutinePreferencesParams = req.body;

            const preferences = await routineService.updateUserRoutinePreferences(
                userId,
                params
            );

            ResponseHelper.success(res, preferences, 'Preferences updated successfully');
        }
    );
}

export default RoutineController;
