
import { Notification } from './notification.model';
import notificationService from './notification.service';
import { NotificationType } from './notification.types';

jest.mock('./notification.model', () => ({
    Notification: {
        create: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        updateOne: jest.fn(),
        updateMany: jest.fn(),
        deleteOne: jest.fn(),
    }
}));

describe('NotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a notification', async () => {
            const data = {
                userId: '507f1f77bcf86cd799439011',
                type: NotificationType.SYSTEM,
                title: 'Test',
                message: 'Hello'
            };

            const mockNotif = { _id: 'n1', ...data, isRead: false };
            (Notification.create as jest.Mock).mockResolvedValue(mockNotif);

            const result = await notificationService.create(data);

            expect(Notification.create).toHaveBeenCalled();
            expect(result).toHaveProperty('_id', 'n1');
        });
    });

    describe('getUserNotifications', () => {
        it('should fetch notifications', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const mockNotifs = [{ _id: 'n1' }];

            const leanMock = jest.fn().mockResolvedValue(mockNotifs);
            const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
            const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
            const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

            (Notification.find as jest.Mock).mockReturnValue({ sort: sortMock });
            (Notification.countDocuments as jest.Mock).mockResolvedValue(5);

            const result = await notificationService.getUserNotifications(userId);

            expect(result.notifications).toEqual(mockNotifs);
            expect(result.total).toBe(5);
        });
    });

    describe('markAsRead', () => {
        it('should update notification status', async () => {
            await notificationService.markAsRead('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439099');
            expect(Notification.updateOne).toHaveBeenCalledWith(
                expect.objectContaining({ _id: expect.anything() }),
                { $set: { isRead: true } }
            );
        });
    });
});
