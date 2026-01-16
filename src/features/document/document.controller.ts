import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { documentService } from './document.service';

export const createDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.create(req.user!._id.toString(), req.body);
        res.status(201).json({
            success: true,
            message: 'Document created successfully',
            data: document,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create document',
            error: (error as Error).message,
        });
    }
};

export const getDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.query.parentId ? (req.query.parentId as string) : null;
        const documents = await documentService.getAll(req.user!._id.toString(), parentId === 'root' ? null : parentId);
        res.status(200).json({
            success: true,
            data: documents,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: (error as Error).message,
        });
    }
};

export const getDocumentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.getById(req.user!._id.toString(), req.params.id);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found',
            });
        }
        res.status(200).json({
            success: true,
            data: document,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch document',
            error: (error as Error).message,
        });
    }
};

export const updateDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const document = await documentService.update(req.user!._id.toString(), req.params.id, req.body);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found',
            });
        }
        res.status(200).json({
            success: true,
            message: 'Document updated successfully',
            data: document,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update document',
            error: (error as Error).message,
        });
    }
};

export const deleteDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const success = await documentService.delete(req.user!._id.toString(), req.params.id);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Document not found',
            });
        }
        res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
            error: (error as Error).message,
        });
    }
};

export const getRecentDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const documents = await documentService.getRecent(req.user!._id.toString());
        res.status(200).json({
            success: true,
            data: documents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent documents',
            error: (error as Error).message
        });
    }
};
