
export interface NotificationContent {
    title: string;
    message: string;
    actionUrl?: string;
}

export type NotificationTemplateType = 'REMINDER_DUE' | 'TASK_CREATED' | 'GOAL_PROGRESS' | 'SYSTEM_ALERT' | 'NUDGE';

export class NotificationTemplates {
    private static templates: Record<string, (payload: any) => NotificationContent> = {
        REMINDER_DUE: (payload) => ({
            title: `⏰ Time for: ${payload.title}`,
            message: payload.description || `This is your scheduled reminder for "${payload.title}".`,
            actionUrl: `/reminders?highlight=${payload.id}`
        }),
        TASK_CREATED: (payload) => ({
            title: '📝 Reminder Set',
            message: `We've scheduled "${payload.title}" for you.`,
            actionUrl: `/reminders?id=${payload.id}`
        }),
        GOAL_PROGRESS: (payload) => ({
            title: '🎯 Milestone Reached!',
            message: `Great job! You made progress on your goal: "${payload.title}".`,
            actionUrl: `/goals/${payload.id}`
        }),
        SYSTEM_ALERT: (payload) => ({
            title: '⚠️ System Notification',
            message: payload.message,
            actionUrl: payload.url
        }),
        NUDGE: (payload) => ({
            title: '✨ Just a thought...',
            message: payload.message || "How is your day going? Want to record a quick thought?",
            actionUrl: '/dashboard'
        })
    };

    static get(type: string, payload: any): NotificationContent {
        const generator = this.templates[type] || this.templates['SYSTEM_ALERT'];
        return generator(payload);
    }
}
