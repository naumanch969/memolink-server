import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

// Tag Types
export interface ITag extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  color?: string;
  description?: string;
  usageCount: number;
}

export interface ITagService {
  createTag(userId: string, tagData: CreateTagRequest): Promise<ITag>;
  getTagById(tagId: string, userId: string): Promise<ITag>;
  getUserTags(userId: string, options?: any): Promise<{
    tags: ITag[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateTag(tagId: string, userId: string, updateData: UpdateTagRequest): Promise<ITag>;
  deleteTag(tagId: string, userId: string): Promise<void>;
  incrementUsage(userId: string, tagIds: string[]): Promise<void>;
  decrementUsage(userId: string, tagIds: string[]): Promise<void>;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  description?: string;
}
