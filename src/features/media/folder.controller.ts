import { Response, NextFunction } from 'express';
import { folderService } from './folder.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../auth/auth.interfaces';

export class FolderController {
  static createFolder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const folder = await folderService.createFolder(userId, req.body);
    ResponseHelper.created(res, folder, 'Folder created successfully');
    return;
  });

  static getFolders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { parentId } = req.query;
    const options = { parentId: parentId as string | undefined };
    const folders = await folderService.getUserFolders(userId, options);
    ResponseHelper.success(res, folders, 'Folders fetched successfully');
    return;
  });

  static getFolderById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const folder = await folderService.getFolderById(id, userId);
    ResponseHelper.success(res, folder, 'Folder fetched successfully');
    return;
  });

  static updateFolder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const folder = await folderService.updateFolder(id, userId, req.body);
    ResponseHelper.success(res, folder, 'Folder updated successfully');
    return;
  });

  static deleteFolder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await folderService.deleteFolder(id, userId);
    ResponseHelper.success(res, undefined, 'Folder deleted successfully');
    return;
  });

  static moveFolderItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const { targetFolderId } = req.body;
    await folderService.moveFolderItems(id, targetFolderId, userId);
    ResponseHelper.success(res, undefined, 'Folder items moved successfully');
    return;
  });
}

export default FolderController;
