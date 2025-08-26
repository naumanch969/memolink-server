import { Request, Response } from 'express';
import categoryService from './category.service';

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await categoryService.createCategory(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await categoryService.getCategories();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
};

export const getCategoryById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await categoryService.getCategoryById(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category',
    });
  }
};

export const updateCategory = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await categoryService.updateCategory(id, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    });
  }
};

export const deleteCategory = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await categoryService.deleteCategory(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    });
  }
};

export const getSubcategories = async (req: Request<{ parentId: string }>, res: Response): Promise<void> => {
  try {
    const { parentId } = req.params;
    const result = await categoryService.getSubcategories(parentId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategories',
    });
  }
};

export const searchCategories = async (req: Request<{}, {}, {}, { query: string }>, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }
    
    const result = await categoryService.searchCategories(query);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Search categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search categories',
    });
  }
};
