import { Request, Response, NextFunction } from 'express';
import reminderService from './reminder.service';
import { CreateReminderRequest, UpdateReminderRequest, GetRemindersQuery } from './reminder.types';
import { asyncHandler } from '../../core/middleware/errorHandler';

class ReminderController {
    // ============================================
    // CREATE
    // ============================================

    createReminder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const data: CreateReminderRequest = req.body;

        const reminder = await reminderService.createReminder(userId, data);

        res.status(201).json({
            success: true,
            message: 'Reminder created successfully',
            data: reminder,
        });
    });

    // ============================================
    // READ
    // ============================================

    getReminders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const query: GetRemindersQuery = req.query;

        const result = await reminderService.getReminders(userId, query);

        res.status(200).json({
            success: true,
            message: 'Reminders fetched successfully',
            data: result.reminders,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: Math.ceil(result.total / result.limit),
            },
        });
    });

    getReminderById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const reminder = await reminderService.getReminderById(userId, id);

        res.status(200).json({
            success: true,
            message: 'Reminder fetched successfully',
            data: reminder,
        });
    });

    getUpcomingReminders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

        const reminders = await reminderService.getUpcomingReminders(userId, limit);

        res.status(200).json({
            success: true,
            message: 'Upcoming reminders fetched successfully',
            data: reminders,
        });
    });

    getOverdueReminders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();

        const reminders = await reminderService.getOverdueReminders(userId);

        res.status(200).json({
            success: true,
            message: 'Overdue reminders fetched successfully',
            data: reminders,
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    updateReminder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const data: UpdateReminderRequest = req.body;

        const reminder = await reminderService.updateReminder(userId, id, data);

        res.status(200).json({
            success: true,
            message: 'Reminder updated successfully',
            data: reminder,
        });
    });

    completeReminder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const { completedAt } = req.body;

        const reminder = await reminderService.completeReminder(
            userId,
            id,
            completedAt ? new Date(completedAt) : undefined
        );

        res.status(200).json({
            success: true,
            message: 'Reminder completed successfully',
            data: reminder,
        });
    });

    cancelReminder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const reminder = await reminderService.cancelReminder(userId, id);

        res.status(200).json({
            success: true,
            message: 'Reminder cancelled successfully',
            data: reminder,
        });
    });

    // ============================================
    // DELETE
    // ============================================

    deleteReminder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        await reminderService.deleteReminder(userId, id);

        res.status(200).json({
            success: true,
            message: 'Reminder deleted successfully',
            data: null,
        });
    });
}

export default new ReminderController();
