
export interface NotificationContent {
    title: string;
    message: string;
    actionUrl?: string;
}

export type NotificationTemplateType = 'REMINDER_DUE' | 'TASK_CREATED' | 'GOAL_ACHIEVED' | 'SYSTEM_ALERT';

export class NotificationTemplates {
    private static templates: Record<string, (payload: any) => NotificationContent> = {
        REMINDER_DUE: (payload) => ({
            title: `⏰ Reminder: ${payload.title}`,
            message: payload.description || `It's time for: ${payload.title}`,
            actionUrl: `/reminders?highlight=${payload.id}`
        }),
        TASK_CREATED: (payload) => ({
            title: '📝 New Task Metadata',
            message: `Success! Task "${payload.title}" has been recorded.`,
            actionUrl: `/reminders?id=${payload.id}`
        }),
        GOAL_PROGRESS: (payload) => ({
            title: '🎯 Goal Milestone!',
            message: `You just made progress on "${payload.title}". Keep it up!`,
            actionUrl: `/goals/${payload.id}`
        }),
        SYSTEM_ALERT: (payload) => ({
            title: '⚠️ System Update',
            message: payload.message,
            actionUrl: payload.url
        })
    };

    static get(type: string, payload: any): NotificationContent {
        const generator = this.templates[type];
        if (!generator) {
            return {
                title: 'Notification',
                message: 'You have a new update.'
            };
        }
        return generator(payload);
    }
}
