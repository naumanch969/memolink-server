import Category from './category.model';
import { Category as CategoryInterface, ApiResponse } from '../../interfaces';

// In-memory storage for testing when database is not available
const inMemoryCategories: any[] = [];
let categoryIdCounter = 1;

export class CategoryService {
  /**
   * Create a new category
   */
  async createCategory(categoryData: Partial<CategoryInterface>): Promise<ApiResponse<CategoryInterface>> {
    try {
      const category = {
        _id: categoryIdCounter.toString(),
        name: categoryData.name,
        displayName: categoryData.displayName,
        color: categoryData.color || '#3B82F6',
        icon: categoryData.icon || '📝',
        description: categoryData.description,
        isActive: true,
        parentCategoryId: categoryData.parentCategoryId,
        sortOrder: categoryData.sortOrder || 0,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryCategories.push(category);
      categoryIdCounter++;

      return {
        success: true,
        data: this.mapCategoryToInterface(category),
        message: 'Category created successfully',
      };
    } catch (error) {
      console.error('Create category error:', error);
      return {
        success: false,
        error: 'Failed to create category',
      };
    }
  }

  /**
   * Get all active categories
   */
  async getCategories(): Promise<ApiResponse<CategoryInterface[]>> {
    try {
      const categories = inMemoryCategories
        .filter(cat => cat.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));

      return {
        success: true,
        data: categories.map(category => this.mapCategoryToInterface(category)),
      };
    } catch (error) {
      console.error('Get categories error:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
      };
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(_id: string): Promise<ApiResponse<CategoryInterface>> {
    try {
      const category = inMemoryCategories.find(cat => cat._id === _id && cat.isActive);

      if (!category) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      return {
        success: true,
        data: this.mapCategoryToInterface(category),
      };
    } catch (error) {
      console.error('Get category by ID error:', error);
      return {
        success: false,
        error: 'Failed to fetch category',
      };
    }
  }

  /**
   * Update category
   */
  async updateCategory(_id: string, updates: Partial<CategoryInterface>): Promise<ApiResponse<CategoryInterface>> {
    try {
      const categoryIndex = inMemoryCategories.findIndex(cat => cat._id === _id && cat.isActive);

      if (categoryIndex === -1) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      // Update the category
      inMemoryCategories[categoryIndex] = {
        ...inMemoryCategories[categoryIndex],
        ...updates,
        updatedAt: new Date(),
      };

      return {
        success: true,
        data: this.mapCategoryToInterface(inMemoryCategories[categoryIndex]),
        message: 'Category updated successfully',
      };
    } catch (error) {
      console.error('Update category error:', error);
      return {
        success: false,
        error: 'Failed to update category',
      };
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(_id: string): Promise<ApiResponse<void>> {
    try {
      const categoryIndex = inMemoryCategories.findIndex(cat => cat._id === _id);
      if (categoryIndex === -1) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      inMemoryCategories.splice(categoryIndex, 1);

      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error) {
      console.error('Delete category error:', error);
      return {
        success: false,
        error: 'Failed to delete category',
      };
    }
  }

  /**
   * Get subcategories
   */
  async getSubcategories(parentId: string): Promise<ApiResponse<CategoryInterface[]>> {
    try {
      const subcategories = inMemoryCategories
        .filter(cat => cat.parentCategoryId === parentId && cat.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));

      return {
        success: true,
        data: subcategories.map(category => this.mapCategoryToInterface(category)),
      };
    } catch (error) {
      console.error('Get subcategories error:', error);
      return {
        success: false,
        error: 'Failed to fetch subcategories',
      };
    }
  }

  /**
   * Search categories
   */
  async searchCategories(query: string): Promise<ApiResponse<CategoryInterface[]>> {
    try {
      const categories = inMemoryCategories
        .filter(cat => 
          cat.isActive && (
            cat.name.toLowerCase().includes(query.toLowerCase()) ||
            cat.displayName.toLowerCase().includes(query.toLowerCase()) ||
            (cat.description && cat.description.toLowerCase().includes(query.toLowerCase()))
          )
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));

      return {
        success: true,
        data: categories.map(category => this.mapCategoryToInterface(category)),
      };
    } catch (error) {
      console.error('Search categories error:', error);
      return {
        success: false,
        error: 'Failed to search categories',
      };
    }
  }

  /**
   * Map database category to interface
   */
  private mapCategoryToInterface(category: any): CategoryInterface {
    return {
      _id: category._id,
      name: category.name,
      displayName: category.displayName,
      color: category.color,
      icon: category.icon,
      description: category.description,
      isActive: category.isActive,
      parentCategoryId: category.parentCategoryId,
      sortOrder: category.sortOrder,
      usageCount: category.usageCount,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

export default new CategoryService();
