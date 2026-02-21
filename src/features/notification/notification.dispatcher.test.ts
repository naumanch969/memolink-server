
import { socketService } from '../../core/socket/socket.service';
import { User } from '../auth/auth.model';
import { getEmailQueue } from '../email/queue/email.queue';
import notificationDispatcher from './notification.dispatcher';
import notificationService from './notification.service';
import { NotificationType } from './notification.types';

jest.mock('./notification.service');
jest.mock('../../core/socket/socket.service');
jest.mock('../../config/redis', () => ({
    redisConnection: {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1)
    }
}));
jest.mock('../auth/auth.model');
jest.mock('../email/queue/email.queue');

describe('NotificationDispatcher', () => {
    const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        preferences: { notifications: true }
    };

    const mockNotification = {
        _id: 'n1',
        userId: mockUser._id,
        title: 'Test Notification',
        message: 'Hello World'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (User.findById as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockUser)
            })
        });
        (notificationService.create as jest.Mock).mockResolvedValue(mockNotification);
        (getEmailQueue as jest.Mock).mockReturnValue({ add: jest.fn() });
    });

    describe('dispatch', () => {
        it('should create database entry and emit socket event', async () => {
            const data = {
                userId: mockUser._id,
                type: NotificationType.SYSTEM,
                title: 'Test',
                message: 'Hello'
            };

            await notificationDispatcher.dispatch(data);

            expect(notificationService.create).toHaveBeenCalledWith(data);
            expect(socketService.emitToUser).toHaveBeenCalledWith(mockUser._id, expect.anything(), mockNotification);
        });

        it('should queue email if preference is enabled and type is email-enabled', async () => {
            const mockAdd = jest.fn();
            (getEmailQueue as jest.Mock).mockReturnValue({ add: mockAdd });

            const data = {
                userId: mockUser._id,
                type: NotificationType.REMINDER,
                title: 'Reminder',
                message: 'Time is up'
            };

            await notificationDispatcher.dispatch(data);

            expect(mockAdd).toHaveBeenCalled();
        });

        it('should not queue email if preference is disabled', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({ ...mockUser, preferences: { notifications: false } })
                })
            });

            const mockAdd = jest.fn();
            (getEmailQueue as jest.Mock).mockReturnValue({ add: mockAdd });

            const data = {
                userId: mockUser._id,
                type: NotificationType.REMINDER,
                title: 'Reminder',
                message: 'Time is up'
            };

            await notificationDispatcher.dispatch(data);

            expect(mockAdd).not.toHaveBeenCalled();
        });

        it('should set actionUrl to undefined if it is invalid', async () => {
            const data = {
                userId: mockUser._id,
                type: NotificationType.SYSTEM,
                title: 'Test',
                message: 'Hello',
                actionUrl: 'http://malicious.com'
            };

            await notificationDispatcher.dispatch(data);

            expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
                actionUrl: undefined
            }));
        });

        it('should allow valid internal actionUrl', async () => {
            const data = {
                userId: mockUser._id,
                type: NotificationType.SYSTEM,
                title: 'Test',
                message: 'Hello',
                actionUrl: '/dashboard'
            };

            await notificationDispatcher.dispatch(data);

            expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
                actionUrl: '/dashboard'
            }));
        });
    });

    describe('dispatchFromTemplate', () => {
        it('should use template content and call dispatch', async () => {
            const spy = jest.spyOn(notificationDispatcher, 'dispatch');

            await notificationDispatcher.dispatchFromTemplate(
                mockUser._id,
                NotificationType.REMINDER,
                'REMINDER_DUE',
                { title: 'My Reminder' }
            );

            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringContaining('My Reminder'),
                type: NotificationType.REMINDER
            }));
        });
    });
});
