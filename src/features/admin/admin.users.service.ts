import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { Entry } from '../entry/entry.model';

export interface UserListFilter {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    isVerified?: boolean;
}

export interface UserListResult {
    users: any[];
    total: number;
    page: number;
    totalPages: number;
}

export class AdminUserService {

    /**
     * Get all users with pagination and filtering
     */
    async getUsers(filter: UserListFilter): Promise<UserListResult> {
        const { page = 1, limit = 20, search, role, isVerified } = filter;
        const skip = (page - 1) * limit;

        const query: any = {};

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }
            ];
        }

        if (role) {
            query.role = role;
        }

        if (typeof isVerified === 'boolean') {
            query.isEmailVerified = isVerified;
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password -googleId -securityConfig.answerHash') // Exclude sensitive
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Get detailed user profile for admin view
     */
    async getUserDetails(userId: string): Promise<any> {
        const user = await User.findById(userId)
            .select('-password -googleId -securityConfig.answerHash')
            .lean();

        if (!user) {
            throw new Error('User not found');
        }

        // Get summary stats for this user
        const [entryCount, mediaCount, storageUsed] = await Promise.all([
            Entry.countDocuments({ userId }),
            // Helper for media count if Media model imported, else just placeholder
            0,
            user.storageUsed || 0
        ]);

        return {
            ...user,
            stats: {
                entries: entryCount,
                media: mediaCount, // Placeholder until MediaService linked
                storage: storageUsed
            }
        };
    }

    /**
     * Update user details (e.g. Role, Verification)
     */
    async updateUser(userId: string, updates: Partial<any>): Promise<any> {
        const allowedUpdates = ['role', 'isEmailVerified', 'name'];
        const sanitizedUpdates: any = {};

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                sanitizedUpdates[key] = updates[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: sanitizedUpdates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            throw new Error('User not found');
        }

        logger.info(`Admin updated user ${userId} fields: ${Object.keys(sanitizedUpdates).join(', ')}`);
        return user;
    }

    /**
     * Delete user and ALL associated data (cascade delete)
     * WARNING: This is irreversible!
     */
    async deleteUser(userId: string): Promise<{ success: boolean; deletedCounts: any }> {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        logger.warn(`Admin initiating CASCADE DELETE for user ${userId} (${user.email})`);

        const deletedCounts: any = {};

        try {
            // Delete entries
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Entry } = require('../entry/entry.model');
                const result = await Entry.deleteMany({ userId });
                deletedCounts.entries = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting entries:', e);
                deletedCounts.entries = 0;
            }

            // Delete people
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Person } = require('../person/person.model');
                const result = await Person.deleteMany({ userId });
                deletedCounts.people = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting people:', e);
                deletedCounts.people = 0;
            }

            // Delete tags
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Tag } = require('../tag/tag.model');
                const result = await Tag.deleteMany({ userId });
                deletedCounts.tags = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting tags:', e);
                deletedCounts.tags = 0;
            }

            // Delete media
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Media } = require('../media/media.model');
                const result = await Media.deleteMany({ userId });
                deletedCounts.media = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting media:', e);
                deletedCounts.media = 0;
            }

            // Delete folders
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Folder } = require('../media/folder.model');
                const result = await Folder.deleteMany({ userId });
                deletedCounts.folders = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting folders:', e);
                deletedCounts.folders = 0;
            }

            // Delete routines
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { RoutineTemplate, RoutineLog, UserRoutinePreferences } = require('../routine/routine.model');
                const [templates, logs, prefs] = await Promise.all([
                    RoutineTemplate.deleteMany({ userId }),
                    RoutineLog.deleteMany({ userId }),
                    UserRoutinePreferences.deleteMany({ userId })
                ]);
                deletedCounts.routineTemplates = templates.deletedCount || 0;
                deletedCounts.routineLogs = logs.deletedCount || 0;
                deletedCounts.routinePreferences = prefs.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting routines:', e);
                deletedCounts.routineTemplates = 0;
                deletedCounts.routineLogs = 0;
                deletedCounts.routinePreferences = 0;
            }

            // Delete goals
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Goal } = require('../goal/goal.model');
                const result = await Goal.deleteMany({ userId });
                deletedCounts.goals = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting goals:', e);
                deletedCounts.goals = 0;
            }

            // Delete reminders
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Reminder } = require('../reminder/reminder.model');
                const result = await Reminder.deleteMany({ userId });
                deletedCounts.reminders = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting reminders:', e);
                deletedCounts.reminders = 0;
            }

            // Delete notifications
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Notification } = require('../notification/notification.model');
                const result = await Notification.deleteMany({ userId });
                deletedCounts.notifications = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting notifications:', e);
                deletedCounts.notifications = 0;
            }

            // Delete documents
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Document } = require('../document/document.model');
                const result = await Document.deleteMany({ userId });
                deletedCounts.documents = result.deletedCount || 0;
            } catch (e) {
                logger.error('Error deleting documents:', e);
                deletedCounts.documents = 0;
            }

            // Finally, delete the user
            await User.findByIdAndDelete(userId);

            logger.info(`User ${userId} (${user.email}) and all associated data deleted successfully`, deletedCounts);

            return {
                success: true,
                deletedCounts
            };
        } catch (error) {
            logger.error('Error during user cascade delete:', error);
            throw new Error('Failed to delete user and associated data');
        }
    }

    /**
     * Deactivate user account (soft delete)
     */
    async deactivateUser(userId: string): Promise<any> {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isActive: false } },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            throw new Error('User not found');
        }

        logger.info(`Admin deactivated user ${userId} (${user.email})`);
        return user;
    }

    /**
     * Reactivate user account
     */
    async reactivateUser(userId: string): Promise<any> {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isActive: true } },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            throw new Error('User not found');
        }

        logger.info(`Admin reactivated user ${userId} (${user.email})`);
        return user;
    }
}

export const adminUserService = new AdminUserService();
