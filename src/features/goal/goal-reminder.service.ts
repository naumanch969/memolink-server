import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { GOAL_STATUS } from '../../shared/constants';
import reminderService from '../reminder/reminder.service';
import { RecurrenceFrequency } from '../reminder/reminder.types';

import { IGoalReminderService } from './goal.interfaces';

export class GoalReminderService implements IGoalReminderService {
    /**
     * Manages reminders linked to a goal based on its tracking schedule.
     * Deletes old reminders and recreates new ones if appropriate.
     */
    async manageReminders(userId: string | Types.ObjectId, goal: any): Promise<void> {
        try {
            // 1. Delete existing linked reminders
            const { Reminder } = await import('../reminder/reminder.model');
            await Reminder.deleteMany({ linkedGoalId: goal._id });

            // If goal is finished or archived, don't create new reminders
            if ([GOAL_STATUS.ARCHIVED, GOAL_STATUS.COMPLETED, GOAL_STATUS.FAILED].includes(goal.status)) {
                return;
            }

            // 2. Define Reminder Config based on Tracking Schedule
            let recurrence: any = { enabled: false };
            const title = `Goal check-in: ${goal.title}`;

            if (goal.trackingSchedule) {
                const ts = goal.trackingSchedule;
                if (ts.frequency === 'daily') {
                    recurrence = { enabled: true, frequency: RecurrenceFrequency.DAILY, interval: 1, endDate: goal.deadline };
                } else if (ts.frequency === 'weekdays') {
                    recurrence = { enabled: true, frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1, 2, 3, 4, 5], endDate: goal.deadline };
                } else if (ts.frequency === 'specific_days' && ts.specificDays) {
                    recurrence = { enabled: true, frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: ts.specificDays, endDate: goal.deadline };
                } else if (ts.frequency === 'interval' && ts.intervalValue) {
                    recurrence = { enabled: true, frequency: RecurrenceFrequency.DAILY, interval: ts.intervalValue, endDate: goal.deadline };
                }
            }

            if (recurrence.enabled) {
                await reminderService.createReminder(userId, {
                    title,
                    date: new Date().toISOString(),
                    allDay: true,
                    recurring: recurrence,
                    linkedGoalId: goal._id.toString()
                });
            }
        } catch (error) {
            logger.error(`[GoalReminderService] Failed to manage reminders for goal ${goal._id}`, error);
        }
    }
}

export const goalReminderService = new GoalReminderService();
