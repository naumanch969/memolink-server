import { EmailService } from './email.service';
import { EmailLog } from './models/email-log.model';
import { EmailTemplate } from './models/email-template.model';
import { Types } from 'mongoose';
import { getEmailQueue } from './queue/email.queue';
import { logger } from '../../config/logger';

jest.mock('./models/email-log.model');
jest.mock('./models/email-template.model');
jest.mock('./queue/email.queue');
jest.mock('../../config/logger');

describe('EmailService', () => {
    let emailService: EmailService;
    let mockQueue: any;

    beforeEach(() => {
        jest.clearAllMocks();
        emailService = new EmailService();
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job123' }),
            addBulk: jest.fn().mockResolvedValue([{ id: 'job1' }, { id: 'job2' }])
        };
        (getEmailQueue as jest.Mock).mockReturnValue(mockQueue);
    });

    describe('sendVerificationEmail', () => {
        it('should create log and add to queue', async () => {
            const mockLog = {
                _id: 'log123',
                save: jest.fn().mockResolvedValue(true),
                status: ''
            };
            (EmailLog.create as jest.Mock).mockResolvedValue(mockLog);

            await emailService.sendVerificationEmail('test@example.com', 'Test User', '123456');

            expect(EmailLog.create).toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalledWith('verification', expect.objectContaining({
                type: 'VERIFICATION',
                data: expect.objectContaining({
                    to: 'test@example.com',
                    logId: 'log123'
                })
            }));
            expect(mockLog.save).toHaveBeenCalled();
        });
    });

    describe('sendTemplatedEmail', () => {
        it('should throw if template not found', async () => {
            (EmailTemplate.findOne as jest.Mock).mockResolvedValue(null);

            await expect(emailService.sendTemplatedEmail('missing', 't@e.com', {}))
                .rejects.toThrow('Active email template not found: missing');
        });

        it('should queue templated email if found', async () => {
            (EmailTemplate.findOne as jest.Mock).mockResolvedValue({
                name: 'welcome',
                subject: 'Welcome!',
                isActive: true
            });
            const mockLog = { _id: 'log123', save: jest.fn(), status: '' };
            (EmailLog.create as jest.Mock).mockResolvedValue(mockLog);

            await emailService.sendTemplatedEmail('welcome', 't@e.com', { name: 'User' });

            expect(mockQueue.add).toHaveBeenCalledWith('templated-email', expect.objectContaining({
                type: 'TEMPLATED'
            }));
        });
    });

    describe('sendBulkEmails', () => {
        it('should queue multiple emails and create multiple logs', async () => {
            const userId1 = new Types.ObjectId().toString();
            const userId2 = new Types.ObjectId().toString();
            const recipients = [
                { to: 'u1@e.com', userId: userId1 },
                { to: 'u2@e.com', userId: userId2 }
            ];
            
            (EmailLog.insertMany as jest.Mock).mockResolvedValue(true);

            const count = await emailService.sendBulkEmails(recipients, 'Hi', '<p>Hi</p>');

            expect(count).toBe(2);
            expect(EmailLog.insertMany).toHaveBeenCalled();
            expect(mockQueue.addBulk).toHaveBeenCalled();
        });
    });

    describe('Waitlist & Badge Notifications', () => {
        it('should queue waitlist confirmation', async () => {
            const mockLog = { _id: 'logW', save: jest.fn(), status: '' };
            (EmailLog.create as jest.Mock).mockResolvedValue(mockLog);

            await emailService.sendWaitlistConfirmationEmail('wait@test.com');

            expect(mockQueue.add).toHaveBeenCalledWith('waitlist_confirmation', expect.objectContaining({
                type: 'WAITLIST_CONFIRMATION'
            }));
        });

        it('should queue badge unlock notification', async () => {
            const mockLog = { _id: 'logB', save: jest.fn(), status: '' };
            (EmailLog.create as jest.Mock).mockResolvedValue(mockLog);

            await emailService.sendSystemEmail('BADGE_UNLOCKED', {
                to: 'badge@test.com',
                userName: 'Tester',
                badgeName: 'Founder',
                badgeDescription: 'First 50',
                badgeId: 'b1',
                rarity: 'Legendary'
            });

            expect(mockQueue.add).toHaveBeenCalledWith('badge_unlocked', expect.objectContaining({
                type: 'BADGE_UNLOCKED'
            }));
        });
    });
});
