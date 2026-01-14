import { Response, NextFunction } from 'express';
import reminderService from './reminder.service';
import { CreateReminderRequest, UpdateReminderRequest, GetRemindersQuery } from './reminder.types';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../../shared/types';

class ReminderController {
    // ============================================
    // CREATE
    // ============================================

    createReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const data: CreateReminderRequest = req.body;

        const reminder = await reminderService.createReminder(userId, data);

        ResponseHelper.created(res, reminder, 'Reminder created successfully');
    });

    // ============================================
    // READ
    // ============================================

    getReminders = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const query: GetRemindersQuery = req.query;

        const result = await reminderService.getReminders(userId, query);

        ResponseHelper.paginated(res, result.reminders, {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
        }, 'Reminders fetched successfully');
    });

    getReminderById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const reminder = await reminderService.getReminderById(userId, id);

        ResponseHelper.success(res, reminder, 'Reminder fetched successfully');
    });

    getUpcomingReminders = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

        const reminders = await reminderService.getUpcomingReminders(userId, limit);

        ResponseHelper.success(res, reminders, 'Upcoming reminders fetched successfully');
    });

    getOverdueReminders = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();

        const reminders = await reminderService.getOverdueReminders(userId);

        ResponseHelper.success(res, reminders, 'Overdue reminders fetched successfully');
    });

    // ============================================
    // UPDATE
    // ============================================

    updateReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const data: UpdateReminderRequest = req.body;

        const reminder = await reminderService.updateReminder(userId, id, data);

        ResponseHelper.success(res, reminder, 'Reminder updated successfully');
    });

    completeReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const { completedAt } = req.body;

        const reminder = await reminderService.completeReminder(
            userId,
            id,
            completedAt ? new Date(completedAt) : undefined
        );

        ResponseHelper.success(res, reminder, 'Reminder completed successfully');
    });

    cancelReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const reminder = await reminderService.cancelReminder(userId, id);

        ResponseHelper.success(res, reminder, 'Reminder cancelled successfully');
    });

    // ============================================
    // DELETE
    // ============================================

    deleteReminder = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        await reminderService.deleteReminder(userId, id);

        ResponseHelper.success(res, null, 'Reminder deleted successfully');
    });
}

export default new ReminderController();
