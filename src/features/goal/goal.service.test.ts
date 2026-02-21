
import { GOAL_STATUS } from '../../shared/constants';
import Goal from './goal.model';
import { goalService } from './goal.service';

jest.mock('./goal.model', () => {
    const mockGoal = {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        findById: jest.fn(),
        findOneAndUpdate: jest.fn(),
        deleteOne: jest.fn(),
        updateMany: jest.fn(),
    };
    return {
        __esModule: true,
        default: mockGoal,
    };
});

jest.mock('./goal-reminder.service', () => ({
    goalReminderService: {
        manageReminders: jest.fn()
    }
}));

jest.mock('../graph/graph.service', () => ({
    graphService: {
        createAssociation: jest.fn().mockResolvedValue({}),
        removeNodeEdges: jest.fn().mockResolvedValue({})
    }
}));

// We strictly test logic, not the mongoose internals
describe('GoalService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createGoal', () => {
        it('should create a goal', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const params = { title: 'Run 5k', type: 'boolean' as any, config: {} };

            const mockGoal = { _id: '507f1f77bcf86cd799439014', ...params, progress: { currentValue: 0 } };

            // Mock static create
            (Goal as any).create.mockResolvedValue(mockGoal);
            (Goal as any).findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockGoal)
            });

            const result = await goalService.createGoal(userId, params);

            expect((Goal as any).create).toHaveBeenCalledWith(expect.objectContaining({
                userId: expect.anything(),
                title: 'Run 5k'
            }));
            expect(result).toEqual(mockGoal);
        });
    });

    describe('getGoals', () => {
        it('should fetch goals with default active status', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const mockGoals = [{ _id: '507f1f77bcf86cd799439014' }];

            const sortMock = jest.fn().mockReturnThis();
            const leanMock = jest.fn().mockResolvedValue(mockGoals);

            (Goal as any).find.mockReturnValue({
                sort: sortMock,
                lean: leanMock
            });
            // We need to fix the chain logic. If sort returns correct chain.
            sortMock.mockReturnValue({ lean: leanMock });

            await goalService.getGoals(userId, {});

            expect((Goal as any).find).toHaveBeenCalledWith(expect.objectContaining({
                status: { $ne: GOAL_STATUS.ARCHIVED }
            }));
        });
    });

});
