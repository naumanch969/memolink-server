import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { User } from '../auth/auth.model';
import { getEmailQueue } from '../email/queue/email.queue';
import notificationService from './notification.service';
import { NotificationTemplates } from './notification.templates';
import { CreateNotificationDTO, INotificationDocument, NotificationType } from './notification.types';

export class NotificationDispatcher {
    /**
     * Dispatch a notification using a template
     */
    async dispatchFromTemplate(
        userId: string,
        type: NotificationType,
        templateKey: string,
        payload: any,
        meta: { referenceId?: string; referenceModel?: string; eventId?: string } = {}
    ): Promise<INotificationDocument> {
        const content = NotificationTemplates.get(templateKey, payload);
        return this.dispatch({
            userId,
            type,
            title: content.title,
            message: content.message,
            actionUrl: content.actionUrl,
            ...meta
        });
    }

    /**
     * Dispatch a notification through multiple channels (In-App, Socket, Email, etc.)
     * based on user preferences.
     */
    async dispatch(data: CreateNotificationDTO): Promise<INotificationDocument> {
        // 1. Validate Action URL
        if (!this.isValidActionUrl(data.actionUrl)) {
            logger.warn(`[NotificationDispatcher] Invalid actionUrl detected: ${data.actionUrl}`);
            data.actionUrl = undefined;
        }

        // 2. Always create the in-app notification (DB)
        const notification = await notificationService.create(data);

        // 2. Fetch user preferences
        const user = await User.findById(data.userId).select('preferences email').lean();
        if (!user) {
            logger.warn(`[NotificationDispatcher] User ${data.userId} not found for dispatch`);
            return notification;
        }

        // 3. Real-time push (Socket) - Throttled
        const throttled = await this.isThrottled(data.userId, data.type);
        if (!throttled) {
            socketService.emitToUser(data.userId, SocketEvents.NOTIFICATION_NEW, notification);
        }

        // 4. Email Notification (if preference is enabled) - Throttled
        if (user.preferences?.notifications && !throttled) {
            // Only send emails for specific types by default to avoid spamming
            if (this.shouldSendEmail(data.type)) {
                await this.dispatchEmail(user.email, data);
            }
        }

        return notification;
    }

    private async isThrottled(userId: string, type: NotificationType): Promise<boolean> {
        try {
            const key = `notif_throttle:${userId}:${type}`;
            const count = await redisConnection.incr(key);
            if (count === 1) {
                await redisConnection.expire(key, 30); // 30 second window
            }
            return count > 5; // Max 5 notifications per type per 30 seconds
        } catch (error) {
            logger.error('[NotificationDispatcher] Throttle check failed', error);
            return false; // Fallback to not throttled on Redis error
        }
    }

    private isValidActionUrl(url?: string): boolean {
        if (!url) return true;
        // Simple validation: must start with / and not be a double slash (open redirect)
        return url.startsWith('/') && !url.startsWith('//');
    }

    private shouldSendEmail(type: NotificationType): boolean {
        // Only email for specific important events for now
        const emailEnabledTypes = [NotificationType.REMINDER, NotificationType.SYSTEM];
        return emailEnabledTypes.includes(type);
    }

    private async dispatchEmail(email: string, data: CreateNotificationDTO) {
        try {
            const emailQueue = getEmailQueue();
            await emailQueue.add(`notification-email-${data.type}-${Date.now()}`, {
                type: 'GENERIC',
                data: {
                    to: email,
                    subject: data.title,
                    text: data.message,
                    html: `<p>${data.message}</p>${data.actionUrl ? `<a href="${data.actionUrl}">View details</a>` : ''}`
                }
            });
            logger.debug(`[NotificationDispatcher] Email queued for ${email}`);
        } catch (error) {
            logger.error(`[NotificationDispatcher] Failed to queue email for ${email}`, error);
        }
    }
}

export const notificationDispatcher = new NotificationDispatcher();
export default notificationDispatcher;
