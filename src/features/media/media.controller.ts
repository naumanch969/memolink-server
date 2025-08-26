import { Request, Response } from 'express';
import mediaService from './media.service';
import { sendCreated, sendSuccess, sendBadRequest, sendNotFound, sendInternalServerError, sendDeleteResponse } from '../../utils/response.utils';

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendBadRequest({ res, error: 'No file uploaded', message: 'Please select a file to upload' });
      return;
    }

    const { description, tags } = req.body;
    const file = req.file;

    // Determine media type from MIME type
    let mediaType: 'image' | 'video' | 'audio' = 'image';
    if (file.mimetype.startsWith('video/')) { 
      mediaType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    }

    const metadata = {
      type: mediaType,
      description,
      tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };

    const result = await mediaService.uploadMedia(file, metadata);

    if (result.success) {
      sendCreated({ res, data: result.data, message: 'Media uploaded successfully' });
    } else {
      sendBadRequest({ res, error: result.error, message: 'Failed to upload media' });
    }
  } catch (error) {
    console.error('Media upload error:', error);
    sendInternalServerError({ res, error: 'Failed to upload media' });
  }
};

export const deleteMedia = async (req: Request<{ publicId: string }>, res: Response): Promise<void> => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      sendBadRequest({ res, error: 'Public ID is required', message: 'Please provide a public ID' });
      return;
    }

    const result = await mediaService.deleteMedia(publicId);

    if (result.success) {
      sendDeleteResponse({ res, id: publicId, message: 'Media deleted successfully' });
    } else {
      sendNotFound({ res, error: result.error, message: 'Media not found' });
    }
  } catch (error) {
    console.error('Media delete error:', error);
    sendInternalServerError({ res, error: 'Failed to delete media' });
  }
};

export const getMediaInfo = async (req: Request<{ publicId: string }>, res: Response): Promise<void> => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      sendBadRequest({ res, error: 'Public ID is required', message: 'Please provide a public ID' });
      return;
    }

    const result = await mediaService.getMediaInfo(publicId);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Media info retrieved successfully' });
    } else {
      sendNotFound({ res, error: result.error, message: 'Media not found' });
    }
  } catch (error) {
    console.error('Get media info error:', error);
    sendInternalServerError({ res, error: 'Failed to get media info' });
  }
};

export const generateThumbnail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicId, width = 300, height = 300, crop = 'fill' } = req.body;

    if (!publicId) {
      sendBadRequest({ res, error: 'Public ID is required', message: 'Please provide a public ID' });
      return;
    }

    const result = await mediaService.generateThumbnail(publicId, width, height, crop);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Thumbnail generated successfully' });
    } else {
      sendNotFound({ res, error: result.error, message: 'Media not found' });
    }
  } catch (error) {
    console.error('Generate thumbnail error:', error);
    sendInternalServerError({ res, error: 'Failed to generate thumbnail' });
  }
};

export const transformMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicId, transformations } = req.body;

    if (!publicId || !transformations) {
      sendBadRequest({ res, error: 'Public ID and transformations are required', message: 'Please provide both public ID and transformations' });
      return;
    }

    const result = await mediaService.transformMedia(publicId, transformations);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Media transformed successfully' });
    } else {
      sendNotFound({ res, error: result.error, message: 'Media not found' });
    }
  } catch (error) {
    console.error('Transform media error:', error);
    sendInternalServerError({ res, error: 'Failed to transform media' });
  }
};

export const getAllMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await mediaService.getAllMedia();

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'All media retrieved successfully' });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch media' });
    }
  } catch (error) {
    console.error('Get all media error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch media' });
  }
};

export const getMediaByType = async (req: Request<{ type: string }>, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const result = await mediaService.getMediaByType(type);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: `Media of type '${type}' retrieved successfully` });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch media by type' });
    }
  } catch (error) {
    console.error('Get media by type error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch media by type' });
  }
};
