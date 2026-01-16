import { CreateDocumentRequest, IDocument, UpdateDocumentRequest } from '../../shared/types';
import Document from './document.model';

class DocumentService {
    async create(userId: string, data: CreateDocumentRequest): Promise<IDocument> {
        const document = await Document.create({
            userId,
            ...data,
        });
        return document.toObject();
    }

    async getById(userId: string, id: string): Promise<IDocument | null> {
        return Document.findOne({ _id: id, userId }).lean();
    }

    async getAll(userId: string, parentId: string | null = null): Promise<IDocument[]> {
        const query: any = { userId, isArchived: false };
        if (parentId !== undefined) {
            query.parentId = parentId;
        }
        return Document.find(query)
            .sort({ updatedAt: -1 })
            .lean();
    }

    async getRecent(userId: string, limit: number = 10): Promise<IDocument[]> {
        return Document.find({ userId, isArchived: false })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();
    }

    async update(userId: string, id: string, data: UpdateDocumentRequest): Promise<IDocument | null> {
        const document = await Document.findOneAndUpdate(
            { _id: id, userId },
            { $set: data },
            { new: true }
        ).lean();
        return document;
    }

    async delete(userId: string, id: string): Promise<boolean> {
        const result = await Document.deleteOne({ _id: id, userId });
        // TODO: Handle recursive deletion of children if needed, or Soft Delete logic
        return result.deletedCount === 1;
    }

    async search(userId: string, query: string): Promise<IDocument[]> {
        return Document.find({
            userId,
            title: { $regex: query, $options: 'i' },
            isArchived: false
        }).limit(20).lean();
    }
}

export const documentService = new DocumentService();
