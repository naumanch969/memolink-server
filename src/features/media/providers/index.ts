/**
 * Media Storage Providers Index
 * 
 * This module provides a factory for creating media storage providers.
 * By default, it uses Cloudinary, but can be extended to support other providers.
 */

export * from './media-storage.interface';
export * from './cloudinary.provider';

import { IMediaStorageProvider } from './media-storage.interface';
import { cloudinaryStorageProvider } from './cloudinary.provider';
import { logger } from '../../../config/logger';

export type StorageProviderType = 'cloudinary' | 's3' | 'local';

/**
 * Factory function to get the configured storage provider
 */
export function getStorageProvider(type: StorageProviderType = 'cloudinary'): IMediaStorageProvider {
  switch (type) {
    case 'cloudinary':
      if (!cloudinaryStorageProvider.isConfigured()) {
        logger.warn('Cloudinary is not properly configured');
      }
      return cloudinaryStorageProvider;
    
    case 's3':
      // Future implementation
      throw new Error('S3 storage provider not yet implemented');
    
    case 'local':
      // Future implementation
      throw new Error('Local storage provider not yet implemented');
    
    default:
      throw new Error(`Unknown storage provider type: ${type}`);
  }
}

// Default export - the currently configured provider
export const mediaStorageProvider = getStorageProvider();
