
import { List } from './list.model';
import { ListService } from './list.service';

jest.mock('./list.model', () => ({
    List: {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        deleteOne: jest.fn(),
        bulkWrite: jest.fn(),
    }
}));

describe('ListService', () => {
    let listService: ListService;

    beforeEach(() => {
        jest.clearAllMocks();
        listService = new ListService();
    });

    describe('createList', () => {
        it('should create a list with correct order', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const params = { title: 'Clock', type: 'clock' as any, data: {} };

            const sortMock = jest.fn().mockReturnThis();
            const selectMock = jest.fn().mockResolvedValue({ order: 2 });

            (List.findOne as jest.Mock).mockReturnValue({
                sort: sortMock,
                select: selectMock
            });

            // Fix chain
            sortMock.mockReturnValue({ select: selectMock });

            const mockList = { _id: 'w1', ...params, order: 3 };
            (List.create as jest.Mock).mockResolvedValue(mockList);

            const result = await listService.createList(userId, params);

            expect(List.create).toHaveBeenCalledWith(expect.objectContaining({ order: 3 }));
            expect(result).toEqual(mockList);
        });
    });

    describe('reorderLists', () => {
        it('should bulk update order', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const ids = ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'];

            await listService.reorderLists(userId, ids);

            expect(List.bulkWrite).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    updateOne: expect.objectContaining({
                        filter: expect.objectContaining({ _id: expect.anything() }),
                        update: { $set: { order: 0 } }
                    })
                })
            ]));
        });
    });
});
