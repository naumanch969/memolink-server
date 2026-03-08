import { Types } from 'mongoose';
import { WebActivity } from '../web-activity/web-activity.model';
import { getEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';
import { EnrichedEntry } from './models/enriched-entry.model';

jest.mock('../web-activity/web-activity.model');
jest.mock('./models/enriched-entry.model');
jest.mock('./enrichment.queue');

describe('EnrichmentService', () => {
    let mockQueue: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueue = { add: jest.fn() };
        (getEnrichmentQueue as jest.Mock).mockReturnValue(mockQueue);
    });

    describe('enqueueActiveEnrichment', () => {
        it('should add job to queue with signalTier', async () => {
            const userId = new Types.ObjectId().toString();
            const entryId = new Types.ObjectId().toString();
            const sessionId = 'session-123';
            const signalTier = 'signal';

            await enrichmentService.enqueueActiveEnrichment(userId, entryId, sessionId, signalTier as any);

            expect(mockQueue.add).toHaveBeenCalledWith('process-active', {
                userId,
                sourceType: 'active',
                sessionId,
                referenceId: entryId,
                signalTier
            });
        });
    });

    describe('evaluatePassiveGate', () => {
        it('should trigger passive enrichment if significance score >= 40', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';

            // High activity (4 hours)
            const mockStats = {
                totalSeconds: 14400, // 4 hours -> 60 score
                domainMap: new Map()
            };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);
            (EnrichedEntry.exists as jest.Mock).mockResolvedValue(false);

            await enrichmentService.evaluatePassiveGate(userId, date);

            expect(mockQueue.add).toHaveBeenCalledWith('process-passive', expect.objectContaining({
                userId,
                sessionId: `${date}-s1`,
                sourceType: 'passive'
            }));
        });

        it('should NOT trigger passive enrichment if significance score < 40', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';

            // Low activity
            const mockStats = {
                totalSeconds: 600, // 10 mins -> ~2.5 score + 10 proxy = 12.5 < 40
                domainMap: new Map()
            };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);

            await enrichmentService.evaluatePassiveGate(userId, date);

            expect(mockQueue.add).not.toHaveBeenCalled();
        });

        it('should NOT trigger twice if already enriched', async () => {
            const userId = new Types.ObjectId().toString();
            const date = '2026-03-07';
            const mockStats = { totalSeconds: 8000 };

            (WebActivity.findOne as jest.Mock).mockResolvedValue(mockStats);
            (EnrichedEntry.exists as jest.Mock).mockResolvedValue(true);

            await enrichmentService.evaluatePassiveGate(userId, date);

            expect(mockQueue.add).not.toHaveBeenCalled();
        });
    });
});
