import os from 'os';
import { logger } from '../../config/logger';
import { eventStream } from '../../core/events/event.stream';
import { EventType, MemolinkEvent } from '../../core/events/event.types';
import notificationDispatcher from './notification.dispatcher';
import { NotificationType } from './notification.types';

export class NotificationWorker {
    private isRunning = false;
    private readonly GROUP_NAME = 'notification_worker_group';
    private readonly CONSUMER_NAME = `consumer_notif_${os.hostname()}_${process.pid}`;

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('[NotificationWorker] Initializing Consumer Group...');
        await eventStream.createGroup(this.GROUP_NAME);

        logger.info(`[NotificationWorker] Started as ${this.CONSUMER_NAME}.`);
        this.loop();
    }

    async stop() {
        logger.info('[NotificationWorker] Stopping worker...');
        this.isRunning = false;
    }

    private async loop() {
        while (this.isRunning) {
            try {
                const items = await eventStream.readGroup(this.GROUP_NAME, this.CONSUMER_NAME, 10);

                if (items.length === 0) {
                    continue;
                }

                for (const item of items) {
                    const { streamId, event } = item;

                    try {
                        await this.processEvent(event);
                        await eventStream.ack(this.GROUP_NAME, streamId);
                    } catch (err) {
                        logger.error(`[NotificationWorker] Error processing event ${event.id}:`, err);
                        // Pel handling logic could go here
                    }
                }
            } catch (error) {
                logger.error('[NotificationWorker] Loop error', error);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    private async processEvent(event: MemolinkEvent) {
        logger.debug(`[NotificationWorker] Processing: ${event.type} for ${event.userId}`);

        switch (event.type) {
            case EventType.TASK_CREATED:
                await notificationDispatcher.dispatchFromTemplate(
                    event.userId,
                    NotificationType.SYSTEM,
                    'TASK_CREATED',
                    { title: event.payload.title, id: event.payload.taskId },
                    { referenceId: event.payload.taskId, referenceModel: 'Reminder', eventId: event.id }
                );
                break;

            case EventType.GOAL_PROGRESS:
                await notificationDispatcher.dispatchFromTemplate(
                    event.userId,
                    NotificationType.GOAL,
                    'GOAL_PROGRESS',
                    { title: event.payload.title, id: event.payload.goalId },
                    { referenceId: event.payload.goalId, referenceModel: 'Goal', eventId: event.id }
                );
                break;

            // Add more event-to-notification mappings here
        }
    }
}

export const notificationWorker = new NotificationWorker();
export default notificationWorker;
