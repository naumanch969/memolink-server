import { Media as MediaInterface, ApiResponse, UploadResult } from '../../interfaces';

// In-memory storage for testing when database is not available
const inMemoryMedia: any[] = [];
let mediaIdCounter = 1;

export class MediaService {
  /**
   * Upload media (simulated for testing)
   */
  async uploadMedia(fileData: any, metadata: any): Promise<ApiResponse<UploadResult>> {
    try {
      const media = {
        _id: mediaIdCounter.toString(),
        type: metadata.type || 'image',
        url: `https://example.com/media/${mediaIdCounter}`,
        thumbnail: `https://example.com/media/${mediaIdCounter}/thumb`,
        publicId: `media_${mediaIdCounter}`,
        filename: metadata.filename || `file_${mediaIdCounter}`,
        mimeType: metadata.mimeType || 'image/jpeg',
        size: metadata.size || 1024,
        duration: metadata.duration,
        width: metadata.width || 800,
        height: metadata.height || 600,
        metadata: metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryMedia.push(media);
      mediaIdCounter++;

      return {
        success: true,
        data: {
          url: media.url,
          publicId: media.publicId,
          width: media.width,
          height: media.height,
          duration: media.duration,
          size: media.size,
          mimeType: media.mimeType,
        },
        message: `${media.type} uploaded successfully`,
      };
    } catch (error) {
      console.error('Media upload error:', error);
      return {
        success: false,
        error: 'Failed to upload media',
      };
    }
  }

  /**
   * Delete media
   */
  async deleteMedia(publicId: string): Promise<ApiResponse<void>> {
    try {
      const mediaIndex = inMemoryMedia.findIndex(m => m.publicId === publicId);
      if (mediaIndex === -1) {
        return {
          success: false,
          error: 'Media not found',
        };
      }

      inMemoryMedia.splice(mediaIndex, 1);

      return {
        success: true,
        message: 'Media deleted successfully',
      };
    } catch (error) {
      console.error('Media delete error:', error);
      return {
        success: false,
        error: 'Failed to delete media',
      };
    }
  }

  /**
   * Get media info
   */
  async getMediaInfo(publicId: string): Promise<ApiResponse<any>> {
    try {
      const media = inMemoryMedia.find(m => m.publicId === publicId);

      if (!media) {
        return {
          success: false,
          error: 'Media not found',
        };
      }

      const mediaInfo = {
        publicId: media.publicId,
        url: media.url,
        format: media.mimeType.split('/')[1],
        width: media.width,
        height: media.height,
        size: media.size,
        duration: media.duration,
        tags: media.metadata?.tags || [],
        context: media.metadata?.context || {},
        createdAt: media.createdAt,
      };

      return {
        success: true,
        data: mediaInfo,
      };
    } catch (error) {
      console.error('Get media info error:', error);
      return {
        success: false,
        error: 'Failed to get media info',
      };
    }
  }

  /**
   * Generate thumbnail
   */
  async generateThumbnail(publicId: string, width = 300, height = 300, crop = 'fill'): Promise<ApiResponse<{ thumbnailUrl: string }>> {
    try {
      const media = inMemoryMedia.find(m => m.publicId === publicId);
      if (!media) {
        return {
          success: false,
          error: 'Media not found',
        };
      }

      const thumbnailUrl = `${media.url}?w=${width}&h=${height}&c=${crop}`;

      return {
        success: true,
        data: { thumbnailUrl },
        message: 'Thumbnail generated successfully',
      };
    } catch (error) {
      console.error('Generate thumbnail error:', error);
      return {
        success: false,
        error: 'Failed to generate thumbnail',
      };
    }
  }

  /**
   * Transform media
   */
  async transformMedia(publicId: string, transformations: any): Promise<ApiResponse<{ transformedUrl: string }>> {
    try {
      const media = inMemoryMedia.find(m => m.publicId === publicId);
      if (!media) {
        return {
          success: false,
          error: 'Media not found',
        };
      }

      const transformedUrl = `${media.url}?transform=${JSON.stringify(transformations)}`;

      return {
        success: true,
        data: { transformedUrl },
        message: 'Media transformed successfully',
      };
    } catch (error) {
      console.error('Transform media error:', error);
      return {
        success: false,
        error: 'Failed to transform media',
      };
    }
  }

  /**
   * Get all media
   */
  async getAllMedia(): Promise<ApiResponse<MediaInterface[]>> {
    try {
      const media = inMemoryMedia.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        success: true,
        data: media.map(m => this.mapMediaToInterface(m)),
      };
    } catch (error) {
      console.error('Get all media error:', error);
      return {
        success: false,
        error: 'Failed to fetch media',
      };
    }
  }

  /**
   * Get media by type
   */
  async getMediaByType(type: string): Promise<ApiResponse<MediaInterface[]>> {
    try {
      const media = inMemoryMedia
        .filter(m => m.type === type)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        success: true,
        data: media.map(m => this.mapMediaToInterface(m)),
      };
    } catch (error) {
      console.error('Get media by type error:', error);
      return {
        success: false,
        error: 'Failed to fetch media by type',
      };
    }
  }

  /**
   * Map database media to interface
   */
  private mapMediaToInterface(media: any): MediaInterface {
    return {
      _id: media._id,
      type: media.type,
      url: media.url,
      thumbnail: media.thumbnail,
      publicId: media.publicId,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
      duration: media.duration,
      width: media.width,
      height: media.height,
      metadata: media.metadata,
    };
  }
}

export default new MediaService();
