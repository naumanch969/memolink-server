import { NotificationQueue } from '../notification/notification.model';
import { Reminder } from './reminder.model';
import reminderService from './reminder.service';
import { ReminderStatus } from './reminder.types';

jest.mock('./reminder.model', () => {
    return {
        Reminder: {
            create: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndDelete: jest.fn(),
            countDocuments: jest.fn(),
        },
    };
});

jest.mock('../notification/notification.model', () => {
    return {
        NotificationQueue: {
            insertMany: jest.fn(),
            deleteMany: jest.fn(),
        },
    };
});

describe('ReminderService', () => {
    const userId = '507f1f77bcf86cd799439011';
    const reminderId = '507f1f77bcf86cd799439017';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createReminder', () => {
        it('should create a reminder and schedule notifications', async () => {
            const data = {
                title: 'Test Reminder',
                date: new Date().toISOString(),
                notifications: { enabled: true, times: [{ type: 'minutes', value: 10 }] }
            };

            const mockReminderDoc = {
                _id: reminderId,
                userId,
                ...data,
                date: new Date(data.date),
                createdAt: new Date(),
                updatedAt: new Date(),
                notifications: data.notifications
            };

            (Reminder.create as jest.Mock).mockResolvedValue(mockReminderDoc);

            const result = await reminderService.createReminder(userId, data as any);

            expect(Reminder.create).toHaveBeenCalled();
            expect(NotificationQueue.insertMany).toHaveBeenCalled();
            expect(result).toHaveProperty('_id', reminderId);
        });
    });

    describe('getReminders', () => {
        it('should fetch reminders with filters', async () => {
            const mockReminders = [{
                _id: reminderId,
                userId,
                title: 'Test',
                date: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                linkedTags: [],
                linkedEntities: [],
                linkedEntries: []
            }];

            const limitMock = jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockReturnValue({
                            populate: jest.fn().mockReturnValue({
                                lean: jest.fn().mockResolvedValue(mockReminders)
                            })
                        })
                    })
                })
            });

            const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
            (Reminder.find as jest.Mock).mockReturnValue({ sort: sortMock });

            // Actually usually chained like find().sort().limit().skip().populate()...
            // My chain above: find().sort() -> returns object with limit() -> returns object with skip() -> ...

            (Reminder.countDocuments as jest.Mock).mockResolvedValue(1);

            const result = await reminderService.getReminders(userId, { limit: 10 });

            expect(result.reminders).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('completeReminder', () => {
        it('should mark reminder as completed', async () => {
            const mockReminderDoc = {
                _id: reminderId,
                userId,
                status: ReminderStatus.PENDING,
                date: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                save: jest.fn().mockResolvedValue(true)
            };

            (Reminder.findOne as jest.Mock).mockResolvedValue(mockReminderDoc);

            const result = await reminderService.completeReminder(userId, reminderId);

            expect(mockReminderDoc.status).toBe(ReminderStatus.COMPLETED);
            expect(mockReminderDoc.save).toHaveBeenCalled();
            expect(NotificationQueue.deleteMany).toHaveBeenCalled();
        });
    });
});
