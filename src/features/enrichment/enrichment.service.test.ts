import { Types } from 'mongoose';
import { getEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';
import { EnrichedEntry } from './models/enriched-entry.model';
import { UsageStats } from './models/usage-stats.model';

jest.mock('./models/usage-stats.model');
jest.mock('./models/enriched-entry.model');
jest.mock('./enrichment.queue');

describe('EnrichmentService', () => {
    let mockQueue: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueue = { add: jest.fn() };
        (getEnrichmentQueue as jest.Mock).mockReturnValue(mockQueue);
    });

    describe('trackSessionActivity', () => {
        it('should trigger passive enrichment if significance score >= 40', async () => {
            const userId = new Types.ObjectId().toString();

            // Simulating high activity for high score
            const mockStats = {
                totalSeconds: 3600, // 60 mins -> 60/240 * 60 = 15 score
                appStats: []
            };

            (UsageStats.findOneAndUpdate as jest.Mock).mockResolvedValue(mockStats);
            (EnrichedEntry.exists as jest.Mock).mockResolvedValue(false);

            // Using explicit interaction count to boost score: 
            // (15) + (40/50 * 40) = 15 + 32 = 47 (Crosses 40 gate)
            await enrichmentService.trackSessionActivity(userId, {
                totalSeconds: 3600,
                productiveSeconds: 3000,
                distractingSeconds: 600,
                interactions: 40
            });

            expect(mockQueue.add).toHaveBeenCalledWith('process-passive', expect.objectContaining({
                userId,
                sourceType: 'passive'
            }));
        });

        it('should NOT trigger passive enrichment if significance score < 40', async () => {
            const userId = new Types.ObjectId().toString();

            // Simulating low activity
            const mockStats = {
                totalSeconds: 600, // 10 mins -> (10/240 * 60) = 2.5 score
                appStats: []
            };

            (UsageStats.findOneAndUpdate as jest.Mock).mockResolvedValue(mockStats);

            // Score will be ~2.5 + 8 (proxy) = 10.5 (< 40)
            await enrichmentService.trackSessionActivity(userId, {
                totalSeconds: 600,
                productiveSeconds: 0,
                distractingSeconds: 600
            });

            expect(mockQueue.add).not.toHaveBeenCalled();
        });

        it('should NOT trigger twice if already enriched', async () => {
            const userId = new Types.ObjectId().toString();
            const mockStats = { totalSeconds: 8000 }; // High activity

            (UsageStats.findOneAndUpdate as jest.Mock).mockResolvedValue(mockStats);
            (EnrichedEntry.exists as jest.Mock).mockResolvedValue(true); // Already enriched

            await enrichmentService.trackSessionActivity(userId, {
                totalSeconds: 8000,
                productiveSeconds: 0,
                distractingSeconds: 0
            });

            expect(mockQueue.add).not.toHaveBeenCalled();
        });
    });
});
