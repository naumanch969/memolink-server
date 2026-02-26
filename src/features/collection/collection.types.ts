import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export interface ICollection extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    icon?: string;
    color?: string;
    description?: string;
    entryCount: number;
}

export interface CreateCollectionRequest {
    name: string;
    icon?: string;
    color?: string;
    description?: string;
}

export interface UpdateCollectionRequest {
    name?: string;
    icon?: string;
    color?: string;
    description?: string;
}
