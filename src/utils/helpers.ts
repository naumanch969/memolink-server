import { Request } from 'express';

/**
 * Get pagination parameters from request query
 */
export const getPaginationParams = (req: Request) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Get sorting parameters from request query
 */
export const getSortParams = (req: Request, defaultSortBy = 'createdAt', defaultOrder = 'desc') => {
  const sortBy = req.query.sortBy as string || defaultSortBy;
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' || defaultOrder;

  const sort: any = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  return sort;
};

/**
 * Create pagination response object
 */
export const createPaginationResponse = (data: any[], page: number, limit: number, total: number) => {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  };
};

/**
 * Sanitize search query
 */
export const sanitizeSearchQuery = (query: string): string => {
  return query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Create date range filter
 */
export const createDateRangeFilter = (dateFrom?: string, dateTo?: string) => {
  const filter: any = {};

  if (dateFrom || dateTo) {
    filter.timestamp = {};
    
    if (dateFrom) {
      filter.timestamp.$gte = new Date(dateFrom);
    }
    
    if (dateTo) {
      filter.timestamp.$lte = new Date(dateTo);
    }
  }

  return filter;
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Format error message
 */
export const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.map((e: any) => e.message).join(', ');
  }
  
  return 'An unexpected error occurred';
};
