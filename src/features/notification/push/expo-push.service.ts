import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { logger } from '../../../config/logger';

class ExpoPushService {
    private expo: Expo;

    constructor() {
        this.expo = new Expo();
    }

    /**
     * Send a notification to multiple tokens
     */
    async sendNotification(tokens: string[], title: string, body: string, data: any = {}) {
        const messages: ExpoPushMessage[] = [];

        for (const pushToken of tokens) {
            // Check that all your push tokens appear to be valid Expo push tokens
            if (!Expo.isExpoPushToken(pushToken)) {
                logger.error(`Push token ${pushToken} is not a valid Expo push token`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: 'default',
                title,
                body,
                data,
                priority: 'high',
                channelId: 'default',
            });
        }

        const chunks = this.expo.chunkPushNotifications(messages);
        const tickets: any[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                logger.error('Error sending push notification chunk', error);
            }
        }

        // tickets should be handled for errors (e.g. DeviceNotRegistered)
        // for simplicity, we'll just log them for now
        this.handleTickets(tickets, tokens);
    }

    private handleTickets(tickets: any[], tokens: string[]) {
        tickets.forEach((ticket, index) => {
            if (ticket.status === 'error') {
                if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                    // Token is no longer valid, should be removed from DB
                    logger.warn(`DeviceNotRegistered for token ${tokens[index]}`);
                }
                logger.error(`Error sending push notification: ${ticket.message}`);
            }
        });
    }
}

export const expoPushService = new ExpoPushService();
export default expoPushService;
