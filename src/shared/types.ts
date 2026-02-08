import { Types } from 'mongoose';
import { DataConfig, DataType, DataValue } from './types/dataProperties';

// Re-export global data types
export { DataConfig, DataType, DataValue };

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Base Types
export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: any;
}

// Pagination Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Search Types
export interface SearchQuery extends PaginationQuery {
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  entity?: string[];
  mediaType?: string;
}
