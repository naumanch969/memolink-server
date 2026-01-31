import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

// Document Types
export interface IDocument extends BaseEntity {
    userId: Types.ObjectId;
    title: string;
    icon?: string;
    coverImage?: string;
    content: any; // JSON for block editor
    isFavorite: boolean;
    isArchived: boolean;
    parentId?: Types.ObjectId | null;
    tags?: string[];
}

export interface CreateDocumentRequest {
    title?: string;
    icon?: string;
    coverImage?: string;
    parentId?: string | null;
    content?: any;
}

export interface UpdateDocumentRequest {
    title?: string;
    icon?: string;
    coverImage?: string;
    content?: any;
    isFavorite?: boolean;
    isArchived?: boolean;
    parentId?: string | null;
    tags?: string[];
}
