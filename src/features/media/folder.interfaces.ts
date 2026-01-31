import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

// Folder Types
export interface IFolder extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: Types.ObjectId;
  path: string;
  isDefault: boolean;
  itemCount: number;
}

export interface CreateFolderRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface IFolderService {
  createFolder(userId: string, folderData: CreateFolderRequest): Promise<IFolder>;
  updateFolder(folderId: string, userId: string, updateData: UpdateFolderRequest): Promise<IFolder>;
  getFolderById(folderId: string, userId: string): Promise<IFolder>;
  getUserFolders(userId: string, options?: any): Promise<{ folders: IFolder[], total: number }>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  moveFolderItems(folderId: string, targetFolderId: string | null, userId: string): Promise<void>;
}
