import { Types } from 'mongoose';
import { WebActivity } from '../web-activity/web-activity.model';
import { ENRICHMENT_JOB_ACTIVE, ENRICHMENT_JOB_PASSIVE } from '../../core/queue/queue.constants';
import { getEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';

jest.mock('../web-activity/web-activity.model');
jest.mock('./enrichment.queue');

describe('EnrichmentService', () => {
    let mockQueue: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueue = { add: jest.fn() };
        (getEnrichmentQueue as jest.Mock).mockReturnValue(mockQueue);
    });

    describe('enqueueActiveEnrichment', () => {
        it('should add job to queue with correct job name and data', async () => {
            const userId = new Types.ObjectId().toString();
            const entryId = new Types.ObjectId().toString();
            const sessionId = 'session-123';
            const signalTier = 'signal';

            await enrichmentService.enqueueActiveEnrichment(userId, entryId, sessionId, signalTier as any);

            expect(mockQueue.add).toHaveBeenCalledWith(ENRICHMENT_JOB_ACTIVE, {
                userId,
                sourceType: 'active',
                sessionId,
                referenceId: entryId,
                signalTier,
            });
        });
    });

    describe('evaluatePassiveGate', () => {
        it('should trigger passive enrichment if significance score >= 40', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';

            const mockStats = {
                totalSeconds: 14400, // 4 hours → score ~60
                domainMap: new Map(),
            };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);

            await enrichmentService.evaluatePassiveGate(userId, date);

            expect(mockQueue.add).toHaveBeenCalledWith(
                ENRICHMENT_JOB_PASSIVE,
                expect.objectContaining({ userId, sourceType: 'passive' }),
                expect.objectContaining({ jobId: expect.stringContaining(userId) })
            );
        });

        it('should NOT trigger passive enrichment if significance score < 40', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';

            const mockStats = {
                totalSeconds: 600, // 10 mins → score < 40
                domainMap: new Map(),
            };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);

            await enrichmentService.evaluatePassiveGate(userId, date);

            expect(mockQueue.add).not.toHaveBeenCalled();
        });

        it('should use jobId deduplication to prevent duplicate passive jobs', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';
            const mockStats = { totalSeconds: 8000 };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);

            await enrichmentService.evaluatePassiveGate(userId, date);

            const [, , options] = (mockQueue.add as jest.Mock).mock.calls[0];
            expect(options.jobId).toMatch(`passive:${userId}:`);
        });
    });
});
