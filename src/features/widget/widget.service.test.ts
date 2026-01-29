
import { Widget } from './widget.model';
import { WidgetService } from './widget.service';

jest.mock('./widget.model', () => ({
    Widget: {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        deleteOne: jest.fn(),
        bulkWrite: jest.fn(),
    }
}));

describe('WidgetService', () => {
    let widgetService: WidgetService;

    beforeEach(() => {
        jest.clearAllMocks();
        widgetService = new WidgetService();
    });

    describe('createWidget', () => {
        it('should create a widget with correct order', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const params = { title: 'Clock', type: 'clock' as any, data: {} };

            const sortMock = jest.fn().mockReturnThis();
            const selectMock = jest.fn().mockResolvedValue({ order: 2 });

            (Widget.findOne as jest.Mock).mockReturnValue({
                sort: sortMock,
                select: selectMock
            });

            // Fix chain
            sortMock.mockReturnValue({ select: selectMock });

            const mockWidget = { _id: 'w1', ...params, order: 3 };
            (Widget.create as jest.Mock).mockResolvedValue(mockWidget);

            const result = await widgetService.createWidget(userId, params);

            expect(Widget.create).toHaveBeenCalledWith(expect.objectContaining({ order: 3 }));
            expect(result).toEqual(mockWidget);
        });
    });

    describe('reorderWidgets', () => {
        it('should bulk update order', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const ids = ['507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'];

            await widgetService.reorderWidgets(userId, ids);

            expect(Widget.bulkWrite).toHaveBeenCalledWith(expect.arrayContaining([
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
