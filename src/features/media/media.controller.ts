import { Request, Response } from 'express';
import mediaService from './media.service';

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    const { type, description, tags } = req.body;
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
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload media',
    });
  }
};

export const deleteMedia = async (req: Request<{ publicId: string }>, res: Response): Promise<void> => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      res.status(400).json({
        success: false,
        error: 'Public ID is required',
      });
      return;
    }

    const result = await mediaService.deleteMedia(publicId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Media delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete media',
    });
  }
};

export const getMediaInfo = async (req: Request<{ publicId: string }>, res: Response): Promise<void> => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      res.status(400).json({
        success: false,
        error: 'Public ID is required',
      });
      return;
    }

    const result = await mediaService.getMediaInfo(publicId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get media info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get media info',
    });
  }
};

export const generateThumbnail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicId, width = 300, height = 300, crop = 'fill' } = req.body;

    if (!publicId) {
      res.status(400).json({
        success: false,
        error: 'Public ID is required',
      });
      return;
    }

    const result = await mediaService.generateThumbnail(publicId, width, height, crop);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Generate thumbnail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate thumbnail',
    });
  }
};

export const transformMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicId, transformations } = req.body;

    if (!publicId || !transformations) {
      res.status(400).json({
        success: false,
        error: 'Public ID and transformations are required',
      });
      return;
    }

    const result = await mediaService.transformMedia(publicId, transformations);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Transform media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transform media',
    });
  }
};

export const getAllMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await mediaService.getAllMedia();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get all media error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media',
    });
  }
};

export const getMediaByType = async (req: Request<{ type: string }>, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const result = await mediaService.getMediaByType(type);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get media by type error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media by type',
    });
  }
};
