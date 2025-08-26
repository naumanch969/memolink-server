import { Request, Response } from 'express';
import entryService from './entry.service';
import { AuthRequest } from '../../interfaces';

export const createEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await entryService.createEntry(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create entry',
    });
  }
};

export const getEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = req.user?.id;

    const result = await entryService.getEntries(userId, page, limit);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entries',
    });
  }
};

export const getEntriesByPerson = async (req: Request<{ personId: string }>, res: Response): Promise<void> => {
  try {
    const { personId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await entryService.getEntriesByPerson(personId, page, limit);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get entries by person error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entries',
    });
  }
};

export const searchEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, filters, sortBy = 'relevance', sortOrder = 'desc' } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    const result = await entryService.searchEntries({
      query,
      filters,
      sortBy,
      sortOrder,
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Search entries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search entries',
    });
  }
};

export const getEntryById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await entryService.getEntryById(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get entry by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entry',
    });
  }
};

export const updateEntry = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await entryService.updateEntry(id, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update entry',
    });
  }
};

export const deleteEntry = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await entryService.deleteEntry(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete entry',
    });
  }
};

export const toggleReaction = async (req: AuthRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, customEmoji } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const result = await entryService.toggleReaction(id, userId, type, customEmoji);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Toggle reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle reaction',
    });
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
