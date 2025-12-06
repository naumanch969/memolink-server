import { Types } from 'mongoose';

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
  createFolder(userId: string, folderData: CreateFolderRequest): Promise<any>;
  updateFolder(folderId: string, userId: string, updateData: UpdateFolderRequest): Promise<any>;
  getFolderById(folderId: string, userId: string): Promise<any>;
  getUserFolders(userId: string, options?: any): Promise<any>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  moveFolderItems(folderId: string, targetFolderId: string | null, userId: string): Promise<void>;
}
