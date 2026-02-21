
import { KnowledgeEntity } from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import { Media } from '../media/media.model';
import { Tag } from '../tag/tag.model';
import { analyticsService } from './analytics.service';

jest.mock('../entry/entry.model', () => ({
    Entry: {
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
        find: jest.fn(),
    }
}));
jest.mock('../entity/entity.model', () => ({
    KnowledgeEntity: {
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
        find: jest.fn(),
    }
}));
jest.mock('../tag/tag.model', () => ({
    Tag: {
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
        find: jest.fn(),
    }
}));
jest.mock('../media/media.model', () => ({
    Media: {
        countDocuments: jest.fn(),
        aggregate: jest.fn(),
    }
}));
jest.mock('../agent/agent.model', () => ({
    AgentTask: {
        findOne: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
                lean: jest.fn()
            })
        })
    }
}));

jest.mock('../agent/agent.service', () => ({
    agentService: {
        createTask: jest.fn().mockResolvedValue({}),
    }
}));

jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    }
}));

describe('AnalyticsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAnalytics', () => {
        it('should aggregate data counts', async () => {
            const userId = '507f1f77bcf86cd799439011';

            (Entry.countDocuments as jest.Mock).mockResolvedValue(10);
            (KnowledgeEntity.countDocuments as jest.Mock).mockResolvedValue(5);
            (Tag.countDocuments as jest.Mock).mockResolvedValue(3);
            (Media.countDocuments as jest.Mock).mockResolvedValue(2);

            (Entry.aggregate as jest.Mock).mockResolvedValue([]); // For frequency
            (KnowledgeEntity.aggregate as jest.Mock).mockResolvedValue([]); // For top people
            (Tag.aggregate as jest.Mock).mockResolvedValue([]); // For top tags
            (Media.aggregate as jest.Mock).mockResolvedValue([]); // For media stats

            const result = await analyticsService.getAnalytics(userId);

            expect(result.totalEntries).toBe(10);
            expect(result.totalEntities).toBe(5);
        });
    });

    describe('getStreak', () => {
        it('should calculate basic streak', async () => {
            const userId = '507f1f77bcf86cd799439011';

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const mockEntries = [
                { date: today },
                { date: yesterday }
            ];

            const leanMock = jest.fn().mockResolvedValue(mockEntries);
            const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
            (Entry.find as jest.Mock).mockReturnValue({ sort: sortMock });

            const result = await analyticsService.getStreak(userId);

            expect(result).toHaveProperty('currentStreak');
        });
    });
});
