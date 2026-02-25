import { CreateTagRequest, ITag, UpdateTagRequest } from "./tag.types";

// Tag Types

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
