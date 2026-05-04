import { Types } from 'mongoose';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { User } from '../auth/auth.model';
import { emailService } from '../email/email.service';
import { whatsappProvider } from '../integrations/providers/whatsapp/whatsapp.provider';
import { Notification } from './notification.model';
import notificationService from './notification.service';
import { NotificationTemplates } from './notification.templates';
import { CreateNotificationDTO, INotificationDocument, NotificationType } from './notification.types';
import expoPushService from './push/expo-push.service';

export class NotificationDispatcher {
    /**
     * Dispatch a notification using a template
     */
    async dispatchFromTemplate(
        userId: string | Types.ObjectId | Types.ObjectId,
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
        const user = await User.findById(data.userId).select('preferences email whatsappNumber pushTokens').lean();
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

        // 5. WhatsApp Notification (if preference is enabled and number exists)
        if (user.preferences?.notifications && user.whatsappNumber && !throttled) {
            if (this.shouldSendWhatsApp(data.type)) {
                const whatsappId = await this.dispatchWhatsApp(user.whatsappNumber, data);
                if (whatsappId) {
                    await Notification.findByIdAndUpdate(notification._id, {
                        whatsappId,
                        whatsappStatus: 'sent'
                    });
                }
            }
        }

        // 6. Mobile Push Notifications via Expo
        if (user.preferences?.notifications && user.pushTokens?.length) {
            const tokens = user.pushTokens.map(pt => pt.token);
            await expoPushService.sendNotification(
                tokens,
                data.title,
                data.message,
                {
                    id: data.referenceId?.toString(),
                    type: data.type,
                    actionUrl: data.actionUrl,
                    ...(data.referenceId ? { [data.referenceModel?.toLowerCase() + 'Id' as string]: data.referenceId.toString() } : {})
                }
            ).catch(err => logger.error('[NotificationDispatcher] Push notification failed', err));
        }

        return notification;
    }

    private async isThrottled(userId: string | Types.ObjectId, type: NotificationType): Promise<boolean> {
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
            await emailService.sendCustomEmail(
                email,
                data.title,
                `<p>${data.message}</p>${data.actionUrl ? `<a href="${data.actionUrl}">View details</a>` : ''}`,
                data.message,
                data.userId.toString()
            );
            logger.debug(`[NotificationDispatcher] Email queued for ${email}`);
        } catch (error) {
            logger.error(`[NotificationDispatcher] Failed to queue email for ${email}`, error);
        }
    }

    private shouldSendWhatsApp(type: NotificationType): boolean {
        // For now, only send critical or reminder notifications to WhatsApp
        const whatsappEnabledTypes = [NotificationType.REMINDER, NotificationType.SYSTEM];
        return whatsappEnabledTypes.includes(type);
    }

    private async dispatchWhatsApp(to: string, data: CreateNotificationDTO): Promise<string | undefined> {
        try {
            const message = `${data.title}: ${data.message}${data.actionUrl ? `\n\nView: ${config.FRONTEND_URL}${data.actionUrl}` : ''}`;
            const messageId = await whatsappProvider.sendMessage(to, message);
            logger.debug(`[NotificationDispatcher] WhatsApp sent to ${to}`, { messageId });
            return messageId;
        } catch (error) {
            logger.error(`[NotificationDispatcher] Failed to send WhatsApp to ${to}`, error);
            return undefined;
        }
    }
}

export const notificationDispatcher = new NotificationDispatcher();
export default notificationDispatcher;
