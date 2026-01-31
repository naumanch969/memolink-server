import { startOfDay } from 'date-fns';
import { Types } from 'mongoose';
import { eventStream } from '../../core/events/EventStream';
import { EventType } from '../../core/events/types';
import { CustomError } from '../../core/middleware/errorHandler';
import { NotificationQueue, Reminder } from './reminder.model';
import { CreateReminderRequest, GetRemindersQuery, GetRemindersResponse, IReminderDocument, NotificationStatus, ReminderResponse, ReminderStatus, UpdateReminderRequest, } from './reminder.types';

class ReminderService {
    // ============================================
    // CREATE
    // ============================================

    async createReminder(userId: string, data: CreateReminderRequest): Promise<ReminderResponse> {
        try {
            // Convert string IDs to ObjectIds
            const reminderData: any = {
                userId: new Types.ObjectId(userId),
                title: data.title,
                description: data.description,
                date: new Date(data.date),
                startTime: data.startTime,
                endTime: data.endTime,
                allDay: data.allDay ?? (!data.startTime && !data.endTime),
                recurring: data.recurring || { enabled: false },
                notifications: data.notifications || {
                    enabled: true,
                    times: [{ type: 'minutes', value: 10 }],
                },
                priority: data.priority || 'medium',
                status: ReminderStatus.PENDING,
            };

            // Add linked items if provided
            if (data.linkedTags?.length) {
                reminderData.linkedTags = data.linkedTags.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedPeople?.length) {
                reminderData.linkedPeople = data.linkedPeople.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedEntries?.length) {
                reminderData.linkedEntries = data.linkedEntries.map((id) => new Types.ObjectId(id));
            }


            const reminder = await Reminder.create(reminderData);

            // Publish Event
            eventStream.publish(
                EventType.TASK_CREATED,
                userId,
                {
                    taskId: reminder._id.toString(),
                    title: reminder.title,
                }
            ).catch(err => console.error('Failed to publish TASK_CREATED event:', err));

            // Schedule notifications
            if (reminder.notifications.enabled) {
                await this.scheduleNotifications(reminder);
            }

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            throw new CustomError(error.message || 'Failed to create reminder', 500);
        }
    }

    // ============================================
    // READ
    // ============================================

    async getReminders(userId: string, query: GetRemindersQuery): Promise<GetRemindersResponse> {
        try {
            const filter: any = { userId: new Types.ObjectId(userId) };

            // Date range filter
            if (query.startDate || query.endDate) {
                filter.date = {};
                if (query.startDate) {
                    filter.date.$gte = new Date(query.startDate);
                }
                if (query.endDate) {
                    filter.date.$lte = new Date(query.endDate);
                }
            }

            // Status filter
            if (query.status) {
                filter.status = Array.isArray(query.status) ? { $in: query.status } : query.status;
            }

            // Priority filter
            if (query.priority) {
                filter.priority = Array.isArray(query.priority) ? { $in: query.priority } : query.priority;
            }

            // Linked items filters
            if (query.tagId) {
                filter.linkedTags = new Types.ObjectId(query.tagId);
            }
            if (query.personId) {
                filter.linkedPeople = new Types.ObjectId(query.personId);
            }
            if (query.entryId) {
                filter.linkedEntries = new Types.ObjectId(query.entryId);
            }

            // Title Search (Regex)
            if (query.q) {
                filter.title = { $regex: query.q, $options: 'i' };
            }


            const limit = query.limit || 50;
            const skip = query.skip || 0;

            const [reminders, total] = await Promise.all([
                Reminder.find(filter)
                    .sort({ date: 1, startTime: 1 })
                    .limit(limit)
                    .skip(skip)
                    .populate('linkedTags', 'name color')
                    .populate('linkedPeople', 'name avatar')
                    .populate('linkedEntries', 'content date')

                    .lean(),
                Reminder.countDocuments(filter),
            ]);

            return {
                reminders: reminders.map((r) => this.formatReminderResponse(r as any)),
                total,
                page: Math.floor(skip / limit) + 1,
                limit,
            };
        } catch (error: any) {
            throw new CustomError(error.message || 'Failed to fetch reminders', 500);
        }
    }

    async getReminderById(userId: string, reminderId: string): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            })
                .populate('linkedTags', 'name color')
                .populate('linkedPeople', 'name avatar')
                .populate('linkedEntries', 'content date')

                .lean();

            if (!reminder) {
                throw new CustomError('Reminder not found', 404);
            }

            return this.formatReminderResponse(reminder as any);
        } catch (error: any) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to fetch reminder', 500);
        }
    }

    async getUpcomingReminders(userId: string, limit: number = 10): Promise<ReminderResponse[]> {
        try {
            const now = new Date();
            const reminders = await Reminder.find({
                userId: new Types.ObjectId(userId),
                status: ReminderStatus.PENDING,
                date: { $gte: startOfDay(now) },
            })
                .sort({ date: 1, startTime: 1 })
                .limit(limit)
                .populate('linkedTags', 'name color')
                .populate('linkedPeople', 'name avatar')
                .lean();

            return reminders.map((r) => this.formatReminderResponse(r as any));
        } catch (error: any) {
            throw new CustomError(error.message || 'Failed to fetch upcoming reminders', 500);
        }
    }

    async getOverdueReminders(userId: string): Promise<ReminderResponse[]> {
        try {
            const now = new Date();
            const reminders = await Reminder.find({
                userId: new Types.ObjectId(userId),
                status: ReminderStatus.PENDING,
                date: { $lt: startOfDay(now) },
            })
                .sort({ date: -1 })
                .populate('linkedTags', 'name color')
                .populate('linkedPeople', 'name avatar')
                .lean();

            return reminders.map((r) => this.formatReminderResponse(r as any));
        } catch (error: any) {
            throw new CustomError(error.message || 'Failed to fetch overdue reminders', 500);
        }
    }

    // ============================================
    // UPDATE
    // ============================================

    async updateReminder(
        userId: string,
        reminderId: string,
        data: UpdateReminderRequest
    ): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw new CustomError('Reminder not found', 404);
            }

            const oldDate = reminder.date ? new Date(reminder.date).toISOString() : null;
            const newDate = data.date ? new Date(data.date).toISOString() : null;

            // Update fields
            if (data.title !== undefined) reminder.title = data.title;
            if (data.description !== undefined) reminder.description = data.description;
            if (data.date !== undefined) reminder.date = new Date(data.date);
            if (data.startTime !== undefined) reminder.startTime = data.startTime;
            if (data.endTime !== undefined) reminder.endTime = data.endTime;
            if (data.allDay !== undefined) reminder.allDay = data.allDay;
            if (data.recurring !== undefined) reminder.recurring = { ...reminder.recurring, ...data.recurring };
            if (data.notifications !== undefined) {
                reminder.notifications = { ...reminder.notifications, ...data.notifications };
            }
            if (data.priority !== undefined) reminder.priority = data.priority;
            if (data.status !== undefined) reminder.status = data.status;

            // Update linked items
            if (data.linkedTags !== undefined) {
                reminder.linkedTags = data.linkedTags.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedPeople !== undefined) {
                reminder.linkedPeople = data.linkedPeople.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedEntries !== undefined) {
                reminder.linkedEntries = data.linkedEntries.map((id) => new Types.ObjectId(id));
            }


            await reminder.save();

            // Publish Reschedule Event if date changed
            if (data.date && oldDate !== newDate) {
                eventStream.publish(
                    EventType.TASK_RESCHEDULED,
                    userId,
                    {
                        taskId: reminder._id.toString(),
                        oldDate,
                        newDate,
                        title: reminder.title
                    }
                ).catch(err => console.error('Failed to publish TASK_RESCHEDULED event:', err));
            }

            // Reschedule notifications if date/time changed
            if (data.date || data.startTime || data.notifications) {
                await this.cancelNotifications(reminderId);
                if (reminder.notifications.enabled) {
                    await this.scheduleNotifications(reminder);
                }
            }

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to update reminder', 500);
        }
    }

    async completeReminder(userId: string, reminderId: string, completedAt?: Date): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw new CustomError('Reminder not found', 404);
            }

            reminder.status = ReminderStatus.COMPLETED;
            reminder.completedAt = completedAt || new Date();
            await reminder.save();

            // Cancel pending notifications
            await this.cancelNotifications(reminderId);

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to complete reminder', 500);
        }
    }

    async cancelReminder(userId: string, reminderId: string): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw new CustomError('Reminder not found', 404);
            }

            reminder.status = ReminderStatus.CANCELLED;
            await reminder.save();

            // Cancel pending notifications
            await this.cancelNotifications(reminderId);

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to cancel reminder', 500);
        }
    }

    // ============================================
    // DELETE
    // ============================================

    async deleteReminder(userId: string, reminderId: string): Promise<void> {
        try {
            const reminder = await Reminder.findOneAndDelete({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw new CustomError('Reminder not found', 404);
            }

            // Cancel pending notifications
            await this.cancelNotifications(reminderId);
        } catch (error: any) {
            if (error instanceof CustomError) throw error;
            throw new CustomError(error.message || 'Failed to delete reminder', 500);
        }
    }

    // ============================================
    // NOTIFICATION MANAGEMENT
    // ============================================

    async scheduleNotifications(reminder: IReminderDocument): Promise<void> {
        try {
            if (!reminder.notifications.enabled || reminder.notifications.times.length === 0) {
                return;
            }

            // Calculate the reminder datetime
            const reminderDateTime = new Date(reminder.date);
            if (reminder.startTime && !reminder.allDay) {
                const [hours, minutes] = reminder.startTime.split(':').map(Number);
                reminderDateTime.setHours(hours, minutes, 0, 0);
            } else {
                reminderDateTime.setHours(9, 0, 0, 0); // Default to 9 AM for all-day reminders
            }

            // Create notification queue entries
            const notifications = reminder.notifications.times.map((notifTime) => {
                let scheduledFor = new Date(reminderDateTime);

                switch (notifTime.type) {
                    case 'minutes':
                        scheduledFor = new Date(scheduledFor.getTime() - notifTime.value * 60 * 1000);
                        break;
                    case 'hours':
                        scheduledFor = new Date(scheduledFor.getTime() - notifTime.value * 60 * 60 * 1000);
                        break;
                    case 'days':
                        scheduledFor = new Date(scheduledFor.getTime() - notifTime.value * 24 * 60 * 60 * 1000);
                        break;
                }

                // Only schedule if in the future
                if (scheduledFor > new Date()) {
                    return {
                        userId: reminder.userId,
                        reminderId: reminder._id,
                        scheduledFor,
                        status: NotificationStatus.PENDING,
                    };
                }
                return null;
            }).filter(Boolean);

            if (notifications.length > 0) {
                await NotificationQueue.insertMany(notifications);
            }
        } catch (error: any) {
            console.error('Failed to schedule notifications:', error);
            // Don't throw - notification scheduling failure shouldn't break reminder creation
        }
    }

    async cancelNotifications(reminderId: string): Promise<void> {
        try {
            await NotificationQueue.deleteMany({
                reminderId: new Types.ObjectId(reminderId),
                status: NotificationStatus.PENDING,
            });
        } catch (error: any) {
            console.error('Failed to cancel notifications:', error);
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    private formatReminderResponse(reminder: any): ReminderResponse {
        return {
            _id: reminder._id.toString(),
            userId: reminder.userId.toString(),
            title: reminder.title,
            description: reminder.description,
            date: reminder.date.toISOString(),
            startTime: reminder.startTime,
            endTime: reminder.endTime,
            allDay: reminder.allDay,
            recurring: reminder.recurring,
            parentReminderId: reminder.parentReminderId?.toString(),
            notifications: reminder.notifications,
            priority: reminder.priority,
            status: reminder.status,
            completedAt: reminder.completedAt?.toISOString(),
            linkedTags: reminder.linkedTags || [],
            linkedPeople: reminder.linkedPeople || [],
            linkedEntries: reminder.linkedEntries || [],

            createdAt: reminder.createdAt.toISOString(),
            updatedAt: reminder.updatedAt.toISOString(),
        };
    }
}

export default new ReminderService();
