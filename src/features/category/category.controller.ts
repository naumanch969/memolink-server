import { Request, Response } from 'express';
import categoryService from './category.service';
import { 
  sendCreated, sendSuccess, sendBadRequest, sendNotFound, sendInternalServerError,
  sendPaginationResponse, sendSearchResponse, sendDeleteResponse, sendUpdateResponse
} from '../../utils/response.utils';

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await categoryService.createCategory(req.body);
    
    if (result.success) {
      sendCreated({ res, data: result.data, message: 'Category created successfully' });
    } else {
      sendBadRequest({ res, error: result.error, message: 'Failed to create category' });
    }
  } catch (error) {
    console.error('Create category error:', error);
    sendInternalServerError({ res, error: 'Failed to create category' });
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await categoryService.getCategories();
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Categories retrieved successfully' });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch categories' });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await categoryService.getCategoryById(_id);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Category retrieved successfully' });
    } else {
      sendNotFound({ res, error: result.error || 'Category not found' });
    }
  } catch (error) {
    console.error('Get category by ID error:', error);
    sendInternalServerError({ res, error: 'Failed to retrieve category' });
  }
};

export const updateCategory = async (req: Request<{ _id: string }, {}, any>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await categoryService.updateCategory(_id, req.body);

    if (result.success) {
      sendUpdateResponse({ res, data: result.data, message: 'Category updated successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to update category' });
    }
  } catch (error) {
    console.error('Update category error:', error);
    sendInternalServerError({ res, error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await categoryService.deleteCategory(_id);

    if (result.success) {
      sendDeleteResponse({ res, id: _id, message: 'Category deleted successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to delete category' });
    }
  } catch (error) {
    console.error('Delete category error:', error);
    sendInternalServerError({ res, error: 'Failed to delete category' });
  }
};

export const getSubcategories = async (req: Request<{ parentId: string }>, res: Response): Promise<void> => {
  try {
    const { parentId } = req.params;
    const result = await categoryService.getSubcategories(parentId);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Subcategories retrieved successfully' });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch subcategories' });
    }
  } catch (error) {
    console.error('Get subcategories error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch subcategories' });
  }
};

export const searchCategories = async (req: Request<{}, {}, {}, { query: string }>, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    
    if (!query) {
      sendBadRequest({ res, error: 'Search query is required', message: 'Please provide a search query' });
      return;
    }
    
    const result = await categoryService.searchCategories(query);
    
    if (result.success) {
      sendSearchResponse({ 
        res, 
        data: result.data, 
        query: query as string, 
        total: result.data?.length || 0, 
        message: 'Search completed successfully' 
      });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Search failed' });
    }
  } catch (error) {
    console.error('Search categories error:', error);
    sendInternalServerError({ res, error: 'Failed to search categories' });
  }
};
