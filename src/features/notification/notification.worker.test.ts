
import { EventType } from '../../core/events/event.types';
import notificationDispatcher from './notification.dispatcher';
import { NotificationType } from './notification.types';
import notificationWorker from './notification.worker';

jest.mock('./notification.dispatcher');
jest.mock('../../core/events/EventStream');

describe('NotificationWorker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processEvent', () => {
        it('should dispatch notification for TASK_CREATED event', async () => {
            const mockEvent = {
                id: 'e1',
                type: EventType.TASK_CREATED,
                userId: 'u1',
                payload: { taskId: 't1', title: 'New Task' },
                source: { platform: 'web' }
            };

            // Accessing private method for testing purpose (casting to any)
            await (notificationWorker as any).processEvent(mockEvent);

            expect(notificationDispatcher.dispatchFromTemplate).toHaveBeenCalledWith(
                'u1',
                NotificationType.SYSTEM,
                'TASK_CREATED',
                { title: 'New Task', id: 't1' },
                { referenceId: 't1', referenceModel: 'Reminder' }
            );
        });

        it('should dispatch notification for GOAL_PROGRESS event', async () => {
            const mockEvent = {
                id: 'e2',
                type: EventType.GOAL_PROGRESS,
                userId: 'u1',
                payload: { goalId: 'g1', title: 'Goal 1' },
                source: { platform: 'web' }
            };

            await (notificationWorker as any).processEvent(mockEvent);

            expect(notificationDispatcher.dispatchFromTemplate).toHaveBeenCalledWith(
                'u1',
                NotificationType.GOAL,
                'GOAL_PROGRESS',
                { title: 'Goal 1', id: 'g1' },
                { referenceId: 'g1', referenceModel: 'Goal' }
            );
        });
    });
});
