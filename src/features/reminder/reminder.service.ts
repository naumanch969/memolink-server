import { startOfDay } from 'date-fns';
import { Types } from 'mongoose';
import logger from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { eventStream } from '../../core/events/event.stream';
import { EventType } from '../../core/events/event.types';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { NotificationQueue } from '../notification/notification.model';
import { NotificationStatus } from '../notification/notification.types';
import { Reminder } from './reminder.model';
import { CreateReminderRequest, GetRemindersQuery, GetRemindersResponse, IReminderDocument, ReminderResponse, ReminderStatus, UpdateReminderRequest, } from './reminder.types';

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
                type: data.type || 'event',
                date: new Date(data.date),
                startTime: data.startTime,
                endTime: data.endTime,
                allDay: data.allDay,
                recurring: data.recurring || { enabled: false },
                notifications: data.notifications || {
                    enabled: true,
                    times: [{ type: 'minutes', value: 0 }], // At time of event
                },
                status: ReminderStatus.PENDING,
            };

            // Enhanced logic: If date contains a time (not midnight) and startTime is missing, extract it
            const dateObj = new Date(data.date);
            if (!reminderData.startTime && (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0)) {
                reminderData.startTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
                if (reminderData.allDay === undefined) {
                    reminderData.allDay = false;
                }
            }

            // Default allDay to true only if no startTime at all
            if (reminderData.allDay === undefined) {
                reminderData.allDay = !reminderData.startTime;
            }


            // Add linked items if provided
            if (data.linkedTags?.length) {
                reminderData.linkedTags = data.linkedTags.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedEntities?.length) {
                reminderData.linkedEntities = data.linkedEntities.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedEntries?.length) {
                reminderData.linkedEntries = data.linkedEntries.map((id) => new Types.ObjectId(id));
            }
            if (data.metadata) {
                reminderData.metadata = data.metadata;
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

            // Create Graph Association
            await graphService.createAssociation({
                fromId: userId,
                fromType: NodeType.USER,
                toId: reminder._id.toString(),
                toType: NodeType.REMINDER,
                relation: EdgeType.HAS_TASK,
                metadata: { title: reminder.title }
            }).catch(err => console.error('[ReminderService] Graph association failed:', err));

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error.code === 11000) {
                throw ApiError.conflict('A similar pending reminder already exists for this time.');
            }
            throw ApiError.internal(error.message || 'Failed to create reminder');
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

            // Type filter
            if (query.type) {
                filter.type = Array.isArray(query.type) ? { $in: query.type } : query.type;
            }

            // Status filter
            if (query.status) {
                filter.status = Array.isArray(query.status) ? { $in: query.status } : query.status;
            }

            // Linked items filters
            if (query.tagId) {
                filter.linkedTags = new Types.ObjectId(query.tagId);
            }
            if (query.entityId) {
                filter.linkedEntities = new Types.ObjectId(query.entityId);
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
                    .populate('linkedEntities', 'name avatar')
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
            throw ApiError.internal(error.message || 'Failed to fetch reminders');
        }
    }

    async getReminderById(userId: string, reminderId: string): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            })
                .populate('linkedTags', 'name color')
                .populate('linkedEntities', 'name avatar')
                .populate('linkedEntries', 'content date')

                .lean();

            if (!reminder) {
                throw ApiError.notFound('Reminder');
            }

            return this.formatReminderResponse(reminder as any);
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            throw ApiError.internal(error.message || 'Failed to fetch reminder');
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
                .populate('linkedEntities', 'name avatar')
                .lean();

            return reminders.map((r) => this.formatReminderResponse(r as any));
        } catch (error: any) {
            throw ApiError.internal(error.message || 'Failed to fetch upcoming reminders');
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
                .populate('linkedEntities', 'name avatar')
                .lean();

            return reminders.map((r) => this.formatReminderResponse(r as any));
        } catch (error: any) {
            throw ApiError.internal(error.message || 'Failed to fetch overdue reminders');
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
                throw ApiError.notFound('Reminder');
            }

            const oldDate = reminder.date ? new Date(reminder.date).toISOString() : null;
            const newDate = data.date ? new Date(data.date).toISOString() : null;

            // Update fields
            if (data.title !== undefined) reminder.title = data.title;
            if (data.description !== undefined) reminder.description = data.description;
            if (data.type !== undefined) reminder.type = data.type;
            if (data.date !== undefined) reminder.date = new Date(data.date);
            if (data.startTime !== undefined) reminder.startTime = data.startTime;
            if (data.endTime !== undefined) reminder.endTime = data.endTime;
            if (data.allDay !== undefined) reminder.allDay = data.allDay;
            if (data.recurring !== undefined) reminder.recurring = { ...reminder.recurring, ...data.recurring };
            if (data.notifications !== undefined) {
                reminder.notifications = { ...reminder.notifications, ...data.notifications };
            }
            if (data.status !== undefined) reminder.status = data.status;

            // Update linked items
            if (data.linkedTags !== undefined) {
                reminder.linkedTags = data.linkedTags.map((id) => new Types.ObjectId(id));
            }
            if (data.linkedEntities !== undefined) {
                reminder.linkedEntities = data.linkedEntities.map((id) => new Types.ObjectId(id));
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
            if (error instanceof ApiError) throw error;
            throw ApiError.internal(error.message || 'Failed to update reminder');
        }
    }

    async completeReminder(userId: string, reminderId: string, completedAt?: Date): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw ApiError.notFound('Reminder');
            }

            reminder.status = ReminderStatus.COMPLETED;
            reminder.completedAt = completedAt || new Date();
            await reminder.save();

            // Cancel any pending notifications for THIS specific instance
            await this.cancelNotifications(reminderId);

            // HANDLE RECURRENCE
            if (reminder.recurring?.enabled) {
                const { calculateNextOccurrence } = await import('./reminder.utils');
                const nextDate = calculateNextOccurrence(
                    reminder.date,
                    reminder.recurring.frequency,
                    reminder.recurring.interval || 1,
                    reminder.recurring.daysOfWeek,
                    reminder.recurring.endDate
                );

                if (nextDate) {
                    // Create the next occurrence
                    const nextReminderData = {
                        userId: reminder.userId,
                        title: reminder.title,
                        description: reminder.description,
                        type: reminder.type,
                        date: nextDate,
                        startTime: reminder.startTime,
                        endTime: reminder.endTime,
                        allDay: reminder.allDay,
                        recurring: reminder.recurring,
                        parentReminderId: reminder.parentReminderId || reminder._id,
                        notifications: reminder.notifications,
                        status: ReminderStatus.PENDING,
                        linkedTags: reminder.linkedTags,
                        linkedEntities: reminder.linkedEntities,
                        linkedEntries: reminder.linkedEntries,
                    };

                    const nextReminder = await Reminder.create(nextReminderData);

                    // Schedule notifications for the NEW one
                    if (nextReminder.notifications.enabled) {
                        await this.scheduleNotifications(nextReminder);
                    }

                    logger.info(`[ReminderService] Scheduled next occurrence for recurring reminder ${reminderId} -> ${nextReminder._id} for ${nextDate.toISOString()}`);

                    const res = this.formatReminderResponse(reminder);
                    res.nextOccurrence = this.formatReminderResponse(nextReminder);
                    return res;
                }
            }

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            throw ApiError.internal(error.message || 'Failed to complete reminder');
        }
    }

    async cancelReminder(userId: string, reminderId: string): Promise<ReminderResponse> {
        try {
            const reminder = await Reminder.findOne({
                _id: new Types.ObjectId(reminderId),
                userId: new Types.ObjectId(userId),
            });

            if (!reminder) {
                throw ApiError.notFound('Reminder');
            }

            reminder.status = ReminderStatus.CANCELLED;
            await reminder.save();

            // Cancel pending notifications
            await this.cancelNotifications(reminderId);

            return this.formatReminderResponse(reminder);
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            throw ApiError.internal(error.message || 'Failed to cancel reminder');
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
                throw ApiError.notFound('Reminder');
            }

            // Cancel pending notifications
            await this.cancelNotifications(reminderId);

            // Cleanup Graph
            const { graphService } = await import('../graph/graph.service');
            await graphService.removeNodeEdges(reminderId).catch(err => logger.error(`[ReminderService] Graph cleanup failed`, err));
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            throw ApiError.internal(error.message || 'Failed to delete reminder');
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

            if (reminder.allDay) {
                // For all-day reminders, default to 9 AM
                reminderDateTime.setHours(9, 0, 0, 0);
            } else if (reminder.startTime) {
                // If startTime is provided, ensure reminderDateTime uses it
                const [hours, minutes] = reminder.startTime.split(':').map(Number);
                reminderDateTime.setHours(hours, minutes, 0, 0);
            }
            // Otherwise, use reminderDateTime as is (from the date string)

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
            type: reminder.type,
            date: reminder.date.toISOString(),
            startTime: reminder.startTime,
            endTime: reminder.endTime,
            allDay: reminder.allDay,
            recurring: reminder.recurring,
            parentReminderId: reminder.parentReminderId?.toString(),
            notifications: reminder.notifications,
            status: reminder.status,
            completedAt: reminder.completedAt?.toISOString(),
            linkedTags: reminder.linkedTags || [],
            linkedEntities: reminder.linkedEntities || [],
            linkedEntries: reminder.linkedEntries || [],

            createdAt: reminder.createdAt.toISOString(),
            updatedAt: reminder.updatedAt.toISOString(),
        };
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<number> {
        const result = await Reminder.deleteMany({ userId });
        logger.info(`Deleted ${result.deletedCount} reminders for user ${userId}`);
        return result.deletedCount || 0;
    }
}

export const reminderService = new ReminderService();
export default reminderService;
