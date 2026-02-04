
import { RoutineLog, RoutineTemplate } from './routine.model';
import { RoutineService } from './routine.service';

jest.mock('./routine.model', () => {
    const mockRoutineTemplate = jest.fn();
    (mockRoutineTemplate as any).find = jest.fn();
    (mockRoutineTemplate as any).findOne = jest.fn();
    (mockRoutineTemplate as any).findById = jest.fn();
    (mockRoutineTemplate as any).findOneAndUpdate = jest.fn();
    (mockRoutineTemplate as any).findOneAndDelete = jest.fn();
    (mockRoutineTemplate as any).findByIdAndUpdate = jest.fn();
    (mockRoutineTemplate as any).bulkWrite = jest.fn();

    const mockRoutineLog = jest.fn();
    (mockRoutineLog as any).find = jest.fn();
    (mockRoutineLog as any).findOne = jest.fn();
    (mockRoutineLog as any).findOneAndUpdate = jest.fn();
    (mockRoutineLog as any).findOneAndDelete = jest.fn();
    (mockRoutineLog as any).deleteMany = jest.fn();

    const mockUserRoutinePreferences = jest.fn();
    (mockUserRoutinePreferences as any).findOne = jest.fn();
    (mockUserRoutinePreferences as any).findOneAndUpdate = jest.fn();

    return {
        RoutineTemplate: mockRoutineTemplate,
        RoutineLog: mockRoutineLog,
        UserRoutinePreferences: mockUserRoutinePreferences,
    };
});

jest.mock('../goal/goal.service', () => ({
    goalService: {
        removeLinkedRoutine: jest.fn(),
        updateProgressFromRoutineLog: jest.fn(),
    }
}));

describe('RoutineService', () => {
    let routineService: RoutineService;

    beforeEach(() => {
        jest.clearAllMocks();
        routineService = new RoutineService();
    });

    describe('createRoutineTemplate', () => {
        it('should create a new routine template', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const params = {
                name: 'Gym',
                type: 'boolean' as any,
                config: {},
                schedule: { frequency: 'daily' } as any
            };

            const mockSave = jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439015', ...params });
            (RoutineTemplate as unknown as jest.Mock).mockImplementation(() => ({
                save: mockSave
            }));

            const result = await routineService.createRoutineTemplate(userId, params);

            expect(mockSave).toHaveBeenCalled();
            expect(result).toHaveProperty('_id', '507f1f77bcf86cd799439015');
        });
    });

    describe('getRoutineTemplates', () => {
        it('should return routines', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const mockRoutines = [{ name: 'Gym' }];

            const populateMock = jest.fn().mockReturnThis();
            const sortMock = jest.fn().mockReturnThis();
            const leanMock = jest.fn().mockResolvedValue(mockRoutines);

            (RoutineTemplate.find as jest.Mock).mockReturnValue({
                populate: populateMock,
                sort: sortMock,
                lean: leanMock
            });
            // Chain fix
            populateMock.mockReturnValue({ sort: sortMock });
            sortMock.mockReturnValue({ lean: leanMock });

            const result = await routineService.getRoutineTemplates(userId);
            expect(result).toEqual(mockRoutines);
        });
    });

    describe('createOrUpdateRoutineLog', () => {
        it('should log a routine completion', async () => {
            // This is a complex logic calculation, so we test the flow
            const userId = '507f1f77bcf86cd799439011';
            const routineId = '507f1f77bcf86cd799439015';
            const routineMock = {
                _id: '507f1f77bcf86cd799439015',
                type: 'boolean',
                config: {},
                streakData: {},
                completionMode: 'strict',
                schedule: { type: 'specific_days', days: [1, 2, 3, 4, 5, 6, 0] }
            };

            (RoutineTemplate.findOne as jest.Mock).mockResolvedValue(routineMock);

            // Should find existing log (null for new)
            (RoutineLog.findOne as jest.Mock).mockResolvedValue(null);

            const leanMock = jest.fn().mockResolvedValue([]);
            const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
            (RoutineLog.find as jest.Mock).mockReturnValue({
                sort: sortMock
            });

            const populateMock = jest.fn();
            (RoutineLog.findOneAndUpdate as jest.Mock).mockReturnValue({
                populate: populateMock
            });
            const toObjectMock = jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439016', completed: true });
            populateMock.mockReturnValue({
                toObject: toObjectMock
            });

            // Mock recalculateStreaks which calls findOne
            // Since recalculateStreaks is private and complex to mock implicitly via class usage within itself, 
            // we let it run but rely on mocks it calls (RoutineLog.find).
            // We just ensure it doesn't crash.
            (RoutineTemplate.findOne as jest.Mock)
                .mockResolvedValueOnce(routineMock) // For createOrUpdateRoutineLog
                .mockResolvedValueOnce(routineMock); // For recalculateStreaks

            const result = await routineService.createOrUpdateRoutineLog(userId, {
                routineId,
                date: new Date().toISOString(),
                data: { value: true }
            });

            expect(RoutineLog.findOneAndUpdate).toHaveBeenCalled();
        });
    });
});
