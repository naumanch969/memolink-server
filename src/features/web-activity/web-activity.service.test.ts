import { Types } from 'mongoose';
import { passiveAnalysisService } from './passive-analysis.service';
import { WebActivitySyncLog } from './web-activity-sync-log.model';
import { WebActivity } from './web-activity.model';
import { webActivityService } from './web-activity.service';

jest.mock('./web-activity.model');
jest.mock('./passive-analysis.service', () => ({
    passiveAnalysisService: {
        processEvents: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('./web-activity-sync-log.model', () => ({
    WebActivitySyncLog: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
    }
}));

describe('WebActivityService', () => {
    const userId = new Types.ObjectId().toString();
    const date = '2026-03-09';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should process events and update aggregates', async () => {
        const batch: any = {
            date,
            syncId: 'sync-123',
            totalSeconds: 300,
            productiveSeconds: 300,
            distractingSeconds: 0,
            domainMap: { 'github.com': 300 },
            events: [
                {
                    domain: 'github.com',
                    url: 'https://github.com',
                    title: 'Coding',
                    startTime: 1000,
                    endTime: 1300,
                    duration: 300
                }
            ]
        };

        const mockFindOneAndUpdate = jest.fn().mockResolvedValue({
            userId,
            date,
            totalSeconds: 300,
            domainMap: new Map([['github.com', 300]])
        });

        // Setup the mock for WebActivity.findOneAndUpdate
        (WebActivity.findOneAndUpdate as jest.Mock) = mockFindOneAndUpdate;

        await webActivityService.syncActivity(userId, batch);

        expect(passiveAnalysisService.processEvents).toHaveBeenCalledWith(userId, date, batch.events);

        expect(mockFindOneAndUpdate).toHaveBeenCalled();
        const callArgs = mockFindOneAndUpdate.mock.calls[0];

        expect(callArgs[0]).toEqual({ userId: new Types.ObjectId(userId), date });
        expect(callArgs[1].$inc).toEqual({
            'domainMap.github__dot__com': 300,
            totalSeconds: 300,
            productiveSeconds: 300,
            distractingSeconds: 0
        });
    });

    it('should ignore duplicate sync attempts (idempotency)', async () => {
        const batch: any = {
            date,
            syncId: 'sync-duplicate',
            totalSeconds: 300,
            productiveSeconds: 300,
            distractingSeconds: 0,
            domainMap: { 'github.com': 300 },
            events: []
        };

        // Mock that the idempotency lookup finds an existing log
        (WebActivitySyncLog.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'duplicate-id' });

        await webActivityService.syncActivity(userId, batch);

        // Events should NOT be processed since aggregate update failed/skipped
        expect(passiveAnalysisService.processEvents).not.toHaveBeenCalled();
    });
});
