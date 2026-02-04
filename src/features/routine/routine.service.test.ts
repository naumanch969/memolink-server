import mongoose from 'mongoose';
import { RoutineLog, RoutineTemplate } from './routine.model';
import { RoutineService } from './routine.service';

jest.mock('mongoose', () => {
    const session = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
    };
    return {
        startSession: jest.fn().mockResolvedValue(session),
        Types: {
            ObjectId: jest.fn().mockImplementation((id) => id),
        },
    };
});

jest.mock('./routine.model', () => {
    const mockRoutineTemplate: any = jest.fn().mockImplementation(() => ({
        save: jest.fn(),
    }));
    mockRoutineTemplate.find = jest.fn().mockReturnThis();
    mockRoutineTemplate.findOne = jest.fn().mockReturnThis();
    mockRoutineTemplate.findById = jest.fn().mockReturnThis();
    mockRoutineTemplate.findOneAndUpdate = jest.fn().mockReturnThis();
    mockRoutineTemplate.findByIdAndUpdate = jest.fn().mockReturnThis();
    mockRoutineTemplate.bulkWrite = jest.fn();
    mockRoutineTemplate.session = jest.fn().mockReturnThis();
    mockRoutineTemplate.populate = jest.fn().mockReturnThis();
    mockRoutineTemplate.lean = jest.fn().mockReturnThis();
    mockRoutineTemplate.sort = jest.fn().mockReturnThis();

    const mockRoutineLog: any = jest.fn().mockImplementation(() => ({
        save: jest.fn(),
    }));
    mockRoutineLog.find = jest.fn().mockReturnThis();
    mockRoutineLog.findOne = jest.fn().mockReturnThis();
    mockRoutineLog.findOneAndUpdate = jest.fn().mockReturnThis();
    mockRoutineLog.deleteMany = jest.fn();
    mockRoutineLog.session = jest.fn().mockReturnThis();
    mockRoutineLog.populate = jest.fn().mockReturnThis();
    mockRoutineLog.lean = jest.fn().mockReturnThis();
    mockRoutineLog.sort = jest.fn().mockReturnThis();

    const mockUserRoutinePreferences: any = jest.fn();
    mockUserRoutinePreferences.findOne = jest.fn().mockReturnThis();
    mockUserRoutinePreferences.findOneAndUpdate = jest.fn().mockReturnThis();
    mockUserRoutinePreferences.session = jest.fn().mockReturnThis();
    mockUserRoutinePreferences.lean = jest.fn().mockReturnThis();

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
            (RoutineTemplate as any).mockImplementation(() => ({
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

            (RoutineTemplate as any).find.mockReturnValue({
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
        it('should log a routine completion within a transaction', async () => {
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

            // Setup mocks for the chain
            const toObjectMock = jest.fn().mockReturnValue({ _id: '507f1f77bcf86cd799439016', data: { value: true } });

            (RoutineTemplate as any).findOne.mockReturnThis();
            (RoutineTemplate as any).session.mockResolvedValue(routineMock);

            (RoutineLog as any).findOne.mockReturnThis();
            (RoutineLog as any).session.mockResolvedValue(null); // No existing log

            (RoutineLog as any).findOneAndUpdate.mockReturnThis();
            (RoutineLog as any).populate.mockReturnThis();
            (RoutineLog as any).toObject = toObjectMock;
            (RoutineLog as any).populate.mockReturnValue({ toObject: toObjectMock });

            // Mock recalculateStreaks calls
            (RoutineLog as any).find.mockReturnThis();
            (RoutineLog as any).sort.mockReturnThis();
            (RoutineLog as any).session.mockReturnThis();
            (RoutineLog as any).lean.mockResolvedValue([]);

            const result = await routineService.createOrUpdateRoutineLog(userId, {
                routineId,
                date: new Date().toISOString(),
                data: { value: true }
            });

            const session = await mongoose.startSession();
            expect(session.startTransaction).toHaveBeenCalled();
            expect(session.commitTransaction).toHaveBeenCalled();
            expect((RoutineLog as any).findOneAndUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ session })
            );
            expect(result).toHaveProperty('data.value', true);
        });
    });
});
