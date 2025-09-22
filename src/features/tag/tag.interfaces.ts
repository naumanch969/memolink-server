import { ITag } from '../../shared/types';

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
