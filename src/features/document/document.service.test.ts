
import Document from './document.model';
import { documentService } from './document.service';

jest.mock('./document.model', () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
}));

describe('DocumentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a document', async () => {
            const userId = 'user123';
            const data = { title: 'Doc', content: 'Content' };
            const mockDoc = { _id: 'doc1', ...data, toObject: () => ({ _id: 'doc1', ...data }) };

            (Document.create as jest.Mock).mockResolvedValue(mockDoc);

            const result = await documentService.create(userId, data);

            expect(Document.create).toHaveBeenCalledWith(expect.objectContaining({ userId, ...data }));
            expect(result).toHaveProperty('_id', 'doc1');
        });
    });

    describe('getAll', () => {
        it('should return documents', async () => {
            const userId = 'user123';
            const mockDocs = [{ _id: 'doc1' }];

            const leanMock = jest.fn().mockResolvedValue(mockDocs);
            const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
            (Document.find as jest.Mock).mockReturnValue({ sort: sortMock });

            const result = await documentService.getAll(userId);

            expect(result).toEqual(mockDocs);
        });
    });
});
