import { v2 as cloudinary } from 'cloudinary';
import { config } from './env';
import { logger } from './logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  // Upload file to Cloudinary
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'memolink',
    options: any = {}
  ): Promise<{
    url: string;
    public_id: string;
    secure_url: string;
    format: string;
    width?: number;
    height?: number;
    duration?: number;
  }> {
    try {
      const uploadOptions = {
        folder,
        resource_type: 'auto' as const,
        ...options,
      };

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadOptions
      );

      logger.info('File uploaded to Cloudinary successfully', {
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
      };
    } catch (error) {
      logger.error('Cloudinary upload failed:', error);
      throw error;
    }
  }

  // Delete file from Cloudinary
  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('File deleted from Cloudinary successfully', { public_id: publicId });
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      throw error;
    }
  }

  // Get file info
  static async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      logger.error('Get file info failed:', error);
      throw error;
    }
  }
}

export default cloudinary;
