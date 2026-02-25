import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import reminderService from './reminder.service';
import { CreateReminderRequest, GetRemindersQuery, UpdateReminderRequest } from './reminder.types';

export class ReminderController {


    static async createReminder(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const data: CreateReminderRequest = req.body;

            const reminder = await reminderService.createReminder(userId, data);

            ResponseHelper.created(res, reminder, 'Reminder created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create reminder', 500, error);
        }
    }



    static async getReminders(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const query: GetRemindersQuery = req.query;

            const result = await reminderService.getReminders(userId, query);

            ResponseHelper.paginated(res, result.reminders, {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / result.limit),
            }, 'Reminders fetched successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch reminders', 500, error);
        }
    }

    static async getReminderById(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const reminder = await reminderService.getReminderById(userId, id);

            ResponseHelper.success(res, reminder, 'Reminder fetched successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch reminder', 500, error);
        }
    }

    static async getUpcomingReminders(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

            const reminders = await reminderService.getUpcomingReminders(userId, limit);

            ResponseHelper.success(res, reminders, 'Upcoming reminders fetched successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch upcoming reminders', 500, error);
        }
    }

    static async getOverdueReminders(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();

            const reminders = await reminderService.getOverdueReminders(userId);

            ResponseHelper.success(res, reminders, 'Overdue reminders fetched successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch overdue reminders', 500, error);
        }
    }



    static async updateReminder(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const data: UpdateReminderRequest = req.body;

            const reminder = await reminderService.updateReminder(userId, id, data);

            ResponseHelper.success(res, reminder, 'Reminder updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update reminder', 500, error);
        }
    }

    static async completeReminder(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const { completedAt } = req.body;

            const reminder = await reminderService.completeReminder(
                userId,
                id,
                completedAt ? new Date(completedAt) : undefined
            );

            ResponseHelper.success(res, reminder, 'Reminder completed successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to complete reminder', 500, error);
        }
    }

    static async cancelReminder(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const reminder = await reminderService.cancelReminder(userId, id);

            ResponseHelper.success(res, reminder, 'Reminder cancelled successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to cancel reminder', 500, error);
        }
    }



    static async deleteReminder(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            await reminderService.deleteReminder(userId, id);

            ResponseHelper.success(res, null, 'Reminder deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete reminder', 500, error);
        }
    }
}
