import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { folderService } from './folder.service';

export class FolderController {
  static async createFolder(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const folder = await folderService.createFolder(userId, req.body);

      ResponseHelper.created(res, folder, 'Folder created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create folder', 500, error);
    }
  }

  static async getFolders(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const parentId = req.query.parentId as string | undefined;
      const result = await folderService.getUserFolders(userId, { parentId });

      ResponseHelper.success(res, result.folders, 'Folders retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve folders', 500, error);
    }
  }

  static async getFolderById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const folder = await folderService.getFolderById(id, userId);

      ResponseHelper.success(res, folder, 'Folder retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve folder', 500, error);
    }
  }

  static async updateFolder(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const folder = await folderService.updateFolder(id, userId, req.body);

      ResponseHelper.success(res, folder, 'Folder updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update folder', 500, error);
    }
  }

  static async deleteFolder(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      await folderService.deleteFolder(id, userId);

      ResponseHelper.success(res, null, 'Folder deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete folder', 500, error);
    }
  }

  static async moveFolderItems(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const { targetFolderId } = req.body;
      await folderService.moveFolderItems(id, targetFolderId, userId);

      ResponseHelper.success(res, null, 'Items moved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to move folder items', 500, error);
    }
  }
}
