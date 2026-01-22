import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import { documentService } from './document.service';

export const createDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.create(req.user!._id.toString(), req.body);
        ResponseHelper.created(res, document, 'Document created successfully');
    } catch (error) {
        ResponseHelper.error(res, 'Failed to create document', 500, error);
    }
};

export const getDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.query.parentId ? (req.query.parentId as string) : null;
        const documents = await documentService.getAll(req.user!._id.toString(), parentId === 'root' ? null : parentId);
        ResponseHelper.success(res, documents);
    } catch (error) {
        ResponseHelper.error(res, 'Failed to fetch documents', 500, error);
    }
};

export const getDocumentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.getById(req.user!._id.toString(), req.params.id);
        if (!document) {
            return ResponseHelper.notFound(res, 'Document not found');
        }
        ResponseHelper.success(res, document);
    } catch (error) {
        ResponseHelper.error(res, 'Failed to fetch document', 500, error);
    }
};

export const updateDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.update(req.user!._id.toString(), req.params.id, req.body);
        if (!document) {
            return ResponseHelper.notFound(res, 'Document not found');
        }
        ResponseHelper.success(res, document, 'Document updated successfully');
    } catch (error) {
        ResponseHelper.error(res, 'Failed to update document', 500, error);
    }
};

export const deleteDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const success = await documentService.delete(req.user!._id.toString(), req.params.id);
        if (!success) {
            return ResponseHelper.notFound(res, 'Document not found');
        }
        ResponseHelper.success(res, null, 'Document deleted successfully');
    } catch (error) {
        ResponseHelper.error(res, 'Failed to delete document', 500, error);
    }
};

export const getRecentDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const documents = await documentService.getRecent(req.user!._id.toString());
        ResponseHelper.success(res, documents);
    } catch (error) {
        ResponseHelper.error(res, 'Failed to fetch recent documents', 500, error);
    }
};
