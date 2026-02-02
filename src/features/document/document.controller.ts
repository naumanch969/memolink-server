import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { documentService } from './document.service';

export class DocumentController {
    static async createDocument(req: AuthenticatedRequest, res: Response) {
        try {
            const document = await documentService.create(req.user!._id.toString(), req.body);
            ResponseHelper.created(res, document, 'Document created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create document', 500, error);
        }
    }

    static async getDocuments(req: AuthenticatedRequest, res: Response) {
        try {
            const parentId = req.query.parentId ? (req.query.parentId as string) : null;
            const documents = await documentService.getAll(req.user!._id.toString(), parentId === 'root' ? null : parentId);
            ResponseHelper.success(res, documents);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch documents', 500, error);
        }
    }

    static async getDocumentById(req: AuthenticatedRequest, res: Response) {
        try {
            const document = await documentService.getById(req.user!._id.toString(), req.params.id);
            if (!document) {
                return ResponseHelper.notFound(res, 'Document not found');
            }
            ResponseHelper.success(res, document);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch document', 500, error);
        }
    }

    static async updateDocument(req: AuthenticatedRequest, res: Response) {
        try {
            const document = await documentService.update(req.user!._id.toString(), req.params.id, req.body);
            if (!document) {
                return ResponseHelper.notFound(res, 'Document not found');
            }
            ResponseHelper.success(res, document, 'Document updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update document', 500, error);
        }
    }

    static async deleteDocument(req: AuthenticatedRequest, res: Response) {
        try {
            const success = await documentService.delete(req.user!._id.toString(), req.params.id);
            if (!success) {
                return ResponseHelper.notFound(res, 'Document not found');
            }
            ResponseHelper.success(res, null, 'Document deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete document', 500, error);
        }
    }

    static async getRecentDocuments(req: AuthenticatedRequest, res: Response) {
        try {
            const documents = await documentService.getRecent(req.user!._id.toString());
            ResponseHelper.success(res, documents);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to fetch recent documents', 500, error);
        }
    }
}
