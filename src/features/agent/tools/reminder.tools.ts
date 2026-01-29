import reminderService from '../../reminder/reminder.service';
import { NotificationTimeType } from '../../reminder/reminder.types';
import { AgentTool } from './types';

export const createReminderTool: AgentTool = {
    definition: {
        name: 'create_reminder',
        description: 'Set a new reminder.',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: {
                    type: 'STRING',
                    description: 'Reminder specific title.'
                },
                date: {
                    type: 'STRING',
                    description: 'Date of the reminder (ISO string).'
                },
                time: {
                    type: 'STRING',
                    description: 'Time in HH:mm format (optional).'
                },
                priority: {
                    type: 'STRING',
                    description: 'Priority: low, medium, high.'
                }
            },
            required: ['title', 'date']
        }
    },
    handler: async (userId, args) => {
        return await reminderService.createReminder(userId, {
            title: args.title,
            date: args.date,
            startTime: args.time,
            priority: args.priority as any || 'medium',
            notifications: {
                enabled: true,
                times: [{ type: NotificationTimeType.MINUTES, value: 15 }]
            }
        });
    }
};

export const getRemindersTool: AgentTool = {
    definition: {
        name: 'get_upcoming_reminders',
        description: 'Get a list of upcoming reminders.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: {
                    type: 'NUMBER',
                    description: 'Limit results (default 10).'
                }
            },
            required: []
        }
    },
    handler: async (userId, args) => {
        const reminders = await reminderService.getUpcomingReminders(userId, args.limit || 10);
        return reminders.map(r => ({
            id: r._id,
            title: r.title,
            date: r.date,
            time: r.startTime,
            diff: new Date(r.date)
        }));
    }
};
