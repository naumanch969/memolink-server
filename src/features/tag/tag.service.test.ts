
import { Tag } from './tag.model';
import { TagService } from './tag.service';

// Mock Mongoose Model
// Mock Mongoose Model
jest.mock('./tag.model', () => {
    const mockTag = jest.fn();
    (mockTag as any).findOne = jest.fn();
    (mockTag as any).find = jest.fn();
    (mockTag as any).create = jest.fn();
    (mockTag as any).findOneAndUpdate = jest.fn();
    (mockTag as any).findOneAndDelete = jest.fn();
    (mockTag as any).countDocuments = jest.fn();
    (mockTag as any).updateMany = jest.fn();
    return { Tag: mockTag };
});

jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('TagService', () => {
    let tagService: TagService;

    beforeEach(() => {
        jest.clearAllMocks();
        tagService = new TagService();
    });

    describe('createTag', () => {
        it('should create a new tag if name is unique', async () => {
            const mockTagData = { name: 'WORK', color: '#000000' };
            const userId = '507f1f77bcf86cd799439011';

            (Tag.findOne as jest.Mock).mockResolvedValue(null);

            // Mock constructor behavior by intercepting the class and manually mocking the instance methods
            // A simpler way for unit testing service logic that just calls new Model() is to mock the implementation of the save method on the prototype or use a factory mock.
            // However, since we can't easily spy on the `new` keyword outcome without a factory in the mock, 
            // we'll assume the service logic relies on the model.

            // We will spy on the save inside the service.
            // Since `new Tag(...)` returns an object, we need `Tag` to be a mock constructor.

            // Re-mocking Tag to be a constructor
            const mockSave = jest.fn().mockResolvedValue({ ...mockTagData, _id: '507f1f77bcf86cd799439012', userId });
            const MockTagImplementation = jest.fn().mockImplementation((args) => ({
                ...args,
                save: mockSave
            }));

            // We need to overwrite the mocked object methods we defined at the top with this implementation
            // But purely for `new Tag()`. The static methods are attached to the class.

            // Refined Mock Strategy:
            (Tag as unknown as jest.Mock).mockImplementation((args) => ({
                ...args,
                save: mockSave
            }));
            (Tag.findOne as jest.Mock).mockResolvedValue(null);

            const result = await tagService.createTag(userId, { name: 'Work' }); // Input 'Work' should be uppercased

            expect(Tag.findOne).toHaveBeenCalledWith({ userId, name: 'WORK' });
            expect(mockSave).toHaveBeenCalled();
            expect(result).toHaveProperty('name', 'WORK');
        });

        it('should throw conflict if tag exists', async () => {
            const userId = 'user123';
            (Tag.findOne as jest.Mock).mockResolvedValue({ _id: 'existing' });

            await expect(tagService.createTag(userId, { name: 'Work' }))
                .rejects
                .toThrow('Tag with this name already exists');
        });
    });

    describe('getUserTags', () => {
        it('should fetch user tags with pagination', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const mockTags = [{ name: 'WORK' }];

            const sortMock = jest.fn().mockReturnThis();
            const skipMock = jest.fn().mockReturnThis();
            const limitMock = jest.fn().mockReturnValue(mockTags); // Final chain returns promise/data

            // Since the service awaits Promise.all([find..., count...])
            // We need find() to return a thenable (Promise-like) or the chain.
            // But limit() is last in chain.

            (Tag.find as jest.Mock).mockReturnValue({
                sort: sortMock,
            });
            sortMock.mockReturnValue({ skip: skipMock });
            limitMock.mockResolvedValue(mockTags);
            skipMock.mockReturnValue({ limit: limitMock });

            (Tag.countDocuments as jest.Mock).mockResolvedValue(1);

            const result = await tagService.getUserTags(userId, { page: 1, limit: 10 });

            expect(result.tags).toEqual(mockTags);
            expect(result.total).toBe(1);
        });
    });
});
