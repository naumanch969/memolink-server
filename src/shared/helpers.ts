import { ArrayUtil } from './utils/array.utils';
import { ColorUtil } from './utils/color.utils';
import { DateUtil } from './utils/date.utils';
import { FileUtil } from './utils/file.utils';
import { MongoUtil } from './utils/mongo.utils';
import { ObjectUtil } from './utils/object.utils';
import { PaginationUtil } from './utils/pagination.utils';
import { StringUtil } from './utils/string.utils';
import { ValidationUtil } from './utils/validation.utils';

/**
 * @deprecated Use specific utility classes from src/shared/utils instead (e.g., MongoUtil, DateUtil).
 * This class serves as a temporary facade during migration.
 */
export class Helpers {
  static isValidObjectId = MongoUtil.isValidObjectId;
  static generateObjectId = MongoUtil.generateObjectId;
  static isMongoError = MongoUtil.isMongoError;
  static getMongoErrorMessage = MongoUtil.getMongoErrorMessage;

  static getPaginationParams = PaginationUtil.getPaginationParams;
  static getSortParams = PaginationUtil.getSortParams;

  static parseDate = DateUtil.parseDate;
  static formatDate = DateUtil.formatDate;
  static getDateRange = DateUtil.getDateRange;
  static getTimeAgo = DateUtil.getTimeAgo;

  static sanitizeSearchQuery = StringUtil.sanitizeSearchQuery;
  static slugify = StringUtil.slugify;
  static truncateText = StringUtil.truncateText;
  static generateHash = StringUtil.generateHash;

  static removeDuplicates = ArrayUtil.removeDuplicates;
  static chunk = ArrayUtil.chunk;

  static pick = ObjectUtil.pick;
  static omit = ObjectUtil.omit;

  static getFileExtension = FileUtil.getFileExtension;
  static formatFileSize = FileUtil.formatFileSize;

  static generateRandomHexColor = ColorUtil.generateRandomHexColor;

  static isValidEmail = ValidationUtil.isValidEmail;
  static isValidPassword = ValidationUtil.isValidPassword;
}

export default Helpers;
