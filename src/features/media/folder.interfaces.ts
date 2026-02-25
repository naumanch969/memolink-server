import { CreateFolderRequest, IFolder, UpdateFolderRequest } from "./folder.types";

// Folder Types

export interface IFolderService {
  createFolder(userId: string, folderData: CreateFolderRequest): Promise<IFolder>;
  updateFolder(folderId: string, userId: string, updateData: UpdateFolderRequest): Promise<IFolder>;
  getFolderById(folderId: string, userId: string): Promise<IFolder>;
  getUserFolders(userId: string, options?: any): Promise<{ folders: IFolder[], total: number }>;
  deleteFolder(folderId: string, userId: string): Promise<void>;
  moveFolderItems(folderId: string, targetFolderId: string | null, userId: string): Promise<void>;
}
