import { Types } from 'mongoose';
import { PAGINATION, SEARCH } from './constants';

// Utility Functions
export class Helpers {
  // ObjectId validation
  static isValidObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  // Generate ObjectId
  static generateObjectId(): Types.ObjectId {
    return new Types.ObjectId();
  }

  // Pagination helpers
  static getPaginationParams(query: any) {
    const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  // Sort helpers
  static getSortParams(query: any, defaultSort: string = 'createdAt') {
    const sort = query.sort || defaultSort;
    const order = query.order === 'asc' ? 1 : -1;

    return { [sort]: order };
  }

  // Search helpers
  static sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') return '';

    // MongoDB $text search does not need regex escaping
    return query
      .trim()
      .slice(0, SEARCH.MAX_QUERY_LENGTH);
  }

  // Date helpers
  static parseDate(dateString: string): Date | null {
    if (!dateString) return null;

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static getDateRange(dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? this.parseDate(dateFrom) : null;
    const to = dateTo ? this.parseDate(dateTo) : null;

    if (to) {
      to.setHours(23, 59, 59, 999); // End of day
    }

    return { from, to };
  }

  // String helpers
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  // Array helpers
  static removeDuplicates<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Object helpers
  static pick<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  static omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => {
      delete result[key];
    });
    return result;
  }

  // Validation helpers
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  // File helpers
  static getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Hash helpers
  static generateHash(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Time helpers
  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  }

  // Error helpers
  static isMongoError(error: any): boolean {
    return error.name === 'MongoError' || error.name === 'MongoServerError';
  }

  static getMongoErrorMessage(error: any): string {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return `${field} already exists`;
    }
    return error.message || 'Database error';
  }

  // Color helpers
  static generateRandomHexColor(): string {
    const hex = Math.floor(Math.random() * 16777215).toString(16);
    return '#' + hex.padStart(6, '0');
  }
}

export default Helpers;
