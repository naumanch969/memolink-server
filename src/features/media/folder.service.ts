import { Folder } from './folder.model';
import { Media } from './media.model';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { CreateFolderRequest, UpdateFolderRequest, IFolderService } from './folder.interfaces';
import { Types } from 'mongoose';
import { IFolder } from '../../shared/types';

export class FolderService implements IFolderService {
  async createFolder(userId: string, folderData: CreateFolderRequest): Promise<IFolder> {
    try {
      // Build path
      let path = '/';
      if (folderData.parentId) {
        const parentFolder = await Folder.findOne({ _id: folderData.parentId, userId });
        if (!parentFolder) {
          throw createNotFoundError('Parent folder');
        }
        path = `${parentFolder.path}${parentFolder.name}/`;
      }

      const folder = new Folder({
        userId: new Types.ObjectId(userId),
        ...folderData,
        path,
        itemCount: 0,
      });

      await folder.save();
      logger.info('Folder created successfully', { folderId: folder._id, userId });
      return folder;
    } catch (error) {
      logger.error('Folder creation failed:', error);
      throw error;
    }
  }

  async updateFolder(folderId: string, userId: string, updateData: UpdateFolderRequest): Promise<IFolder> {
    try {
      // Check if moving to a different parent
      if (updateData.parentId !== undefined) {
        const folder = await Folder.findOne({ _id: folderId, userId });
        if (!folder) {
          throw createNotFoundError('Folder');
        }

        let newPath = '/';
        if (updateData.parentId) {
          const parentFolder = await Folder.findOne({ _id: updateData.parentId, userId });
          if (!parentFolder) {
            throw createNotFoundError('Parent folder');
          }
          // Prevent circular reference
          if (parentFolder.path.includes(folder._id.toString())) {
            throw new Error('Cannot move folder into its own subfolder');
          }
          newPath = `${parentFolder.path}${parentFolder.name}/`;
        }
        updateData = { ...updateData, path: newPath } as any;
      }

      const folder = await Folder.findOneAndUpdate(
        { _id: folderId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!folder) {
        throw createNotFoundError('Folder');
      }

      return folder;
    } catch (error) {
      logger.error('Folder update failed:', error);
      throw error;
    }
  }

  async getFolderById(folderId: string, userId: string): Promise<IFolder> {
    try {
      const folder = await Folder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw createNotFoundError('Folder');
      }
      return folder;
    } catch (error) {
      logger.error('Get folder by ID failed:', error);
      throw error;
    }
  }

  async getUserFolders(userId: string, options: any = {}): Promise<IFolder[]> {
    try {
      const query: any = { userId };
      
      // Filter by parent (for nested structure)
      if (options.parentId !== undefined) {
        query.parentId = options.parentId || null;
      }

      const folders = await Folder.find(query).sort({ name: 1 });
      
      // Update item counts
      await Promise.all(
        folders.map(async (folder) => {
          const count = await Media.countDocuments({ folderId: folder._id, userId });
          if (folder.itemCount !== count) {
            folder.itemCount = count;
            await folder.save();
          }
        })
      );

      return folders;
    } catch (error) {
      logger.error('Get user folders failed:', error);
      throw error;
    }
  }

  async deleteFolder(folderId: string, userId: string): Promise<void> {
    try {
      const folder = await Folder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw createNotFoundError('Folder');
      }

      // Check if folder has subfolders
      const subfolders = await Folder.countDocuments({ parentId: folderId, userId });
      if (subfolders > 0) {
        throw new Error('Cannot delete folder with subfolders. Please delete or move subfolders first.');
      }

      // Move all media items to root (no folder)
      await Media.updateMany(
        { folderId: new Types.ObjectId(folderId), userId: new Types.ObjectId(userId) },
        { $set: { folderId: null } }
      );

      await Folder.findByIdAndDelete(folderId);
      logger.info('Folder deleted successfully', { folderId, userId });
    } catch (error) {
      logger.error('Folder deletion failed:', error);
      throw error;
    }
  }

  async moveFolderItems(folderId: string, targetFolderId: string | null, userId: string): Promise<void> {
    try {
      const folder = await Folder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw createNotFoundError('Folder');
      }

      if (targetFolderId) {
        const targetFolder = await Folder.findOne({ _id: targetFolderId, userId });
        if (!targetFolder) {
          throw createNotFoundError('Target folder');
        }
      }

      // Move all media items from source to target folder
      await Media.updateMany(
        { folderId: new Types.ObjectId(folderId), userId: new Types.ObjectId(userId) },
        { $set: { folderId: targetFolderId ? new Types.ObjectId(targetFolderId) : null } }
      );

      logger.info('Folder items moved successfully', { folderId, targetFolderId, userId });
    } catch (error) {
      logger.error('Move folder items failed:', error);
      throw error;
    }
  }
}

export const folderService = new FolderService();
export default FolderService;
