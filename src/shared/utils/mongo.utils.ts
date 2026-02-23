import { Types } from 'mongoose';

export class MongoUtil {
    /**
     * Validates if a string is a valid MongoDB ObjectId
     */
    static isValidObjectId(id: string): boolean {
        return Types.ObjectId.isValid(id);
    }

    /**
     * Generates a new MongoDB ObjectId
     */
    static generateObjectId(): Types.ObjectId {
        return new Types.ObjectId();
    }

    /**
     * Checks if an error is a MongoDB specific error
     */
    static isMongoError(error: any): boolean {
        return error.name === 'MongoError' || error.name === 'MongoServerError';
    }

    /**
     * Extracts a user-friendly message from a MongoDB error
     */
    static getMongoErrorMessage(error: any): string {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return `${field} already exists`;
        }
        return error.message || 'Database error';
    }
}
