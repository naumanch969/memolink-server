import { Request, Response } from 'express';
import entryService from './entry.service';
import { AuthRequest } from '../../interfaces';
import { 
  sendCreated, sendSuccess, sendBadRequest, sendNotFound, sendInternalServerError, 
  sendPaginationResponse, sendSearchResponse, sendDeleteResponse, sendUpdateResponse, sendUnauthorized 
} from '../../utils/response.utils';

export const createEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await entryService.createEntry(req.body);
    
    if (result.success) {
      sendCreated({ res, data: result.data, message: 'Entry created successfully' });
    } else {
      sendBadRequest({ res, error: result.error, message: 'Failed to create entry' });
    }
  } catch (error) {
    console.error('Create entry error:', error);
    sendInternalServerError({ res, error: 'Failed to create entry' });
  }
};

export const getEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user?._id;

    const result = await entryService.getEntries(userId, page, limit);
    
    if (result.success) {
      sendPaginationResponse({ 
        res, 
        data: result.data, 
        pagination: { 
          currentPage: page, 
          limit, 
          totalCount: (result.pagination as any)?.total || 0, 
          totalPages: (result.pagination as any)?.pages || 0 
        },
        message: 'Entries retrieved successfully'
      });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch entries' });
    }
  } catch (error) {
    console.error('Get entries error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch entries' });
  }
};

export const getEntriesByPerson = async (req: Request<{ personId: string }>, res: Response): Promise<void> => {
  try {
    const { personId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await entryService.getEntriesByPerson(personId, page, limit);
    
    if (result.success) {
      sendPaginationResponse({ 
        res, 
        data: result.data, 
        pagination: { 
          currentPage: page, 
          limit, 
          totalCount: (result.pagination as any)?.total || 0, 
          totalPages: (result.pagination as any)?.pages || 0 
        },
        message: 'Entries by person retrieved successfully'
      });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch entries' });
    }
  } catch (error) {
    console.error('Get entries by person error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch entries' });
  }
};

export const searchEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, filters, sortBy = 'relevance', sortOrder = 'desc' } = req.body;

    if (!query) {
      sendBadRequest({ res, error: 'Search query is required', message: 'Please provide a search query' });
      return;
    }

    const result = await entryService.searchEntries({
      query,
      filters,
      sortBy,
      sortOrder,
    });
    
    if (result.success) {
      sendSearchResponse({ 
        res, 
        data: result.data, 
        query, 
        total: result.data?.length || 0, 
        message: 'Search completed successfully' 
      });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Search failed' });
    }
  } catch (error) {
    console.error('Search entries error:', error);
    sendInternalServerError({ res, error: 'Failed to search entries' });
  }
};

export const getEntryById = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await entryService.getEntryById(_id);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Entry retrieved successfully' });
    } else {
      sendNotFound({ res, error: result.error || 'Entry not found' });
    }
  } catch (error) {
    console.error('Get entry by ID error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch entry' });
  }
};

export const updateEntry = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await entryService.updateEntry(_id, req.body);
    
    if (result.success) {
      sendUpdateResponse({ res, data: result.data, message: 'Entry updated successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to update entry' });
    }
  } catch (error) {
    console.error('Update entry error:', error);
    sendInternalServerError({ res, error: 'Failed to update entry' });
  }
};

export const deleteEntry = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await entryService.deleteEntry(_id);
    
    if (result.success) {
      sendDeleteResponse({ res, id: _id, message: 'Entry deleted successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to delete entry' });
    }
  } catch (error) {
    console.error('Delete entry error:', error);
    sendInternalServerError({ res, error: 'Failed to delete entry' });
  }
};

export const toggleReaction = async (req: AuthRequest<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const { type, customEmoji } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      sendUnauthorized({ res, error: 'Authentication required' });
      return;
    }

    const result = await entryService.toggleReaction(_id, userId, type, customEmoji);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Reaction toggled successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to toggle reaction' });
    }
  } catch (error) {
    console.error('Toggle reaction error:', error);
    sendInternalServerError({ res, error: 'Failed to toggle reaction' });
  }
};

export const getEntryStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await entryService.getEntryStats();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get entry stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entry stats',
    });
  }
};
