import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { entityService } from '../entity/entity.service';
import { Entry } from '../entry/entry.model';
import { entryService } from '../entry/entry.service';
import { goalService } from '../goal/goal.service';
import { folderService } from '../media/folder.service';
import { Media } from '../media/media.model';
import { mediaService } from '../media/media.service';
import { notificationService } from '../notification/notification.service';
import { reminderService } from '../reminder/reminder.service';
import { tagService } from '../tag/tag.service';
import { webActivityService } from '../web-activity/web-activity.service';

import { IUsersAdminService } from './users.interfaces';
import { UserListFilter, UserListResult } from "./users.types";

export class UsersAdminService implements IUsersAdminService {

    /**
     * Get all users with pagination and filtering
     */
    async getUsers(filter: UserListFilter): Promise<UserListResult> {
        const { page = 1, limit = 20, search, role, isVerified, sortBy, sortOrder } = filter;
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

        const sort: any = {};
        if (sortBy) {
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1; // Default sort
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password -googleId -securityConfig.answerHash') // Exclude sensitive
                .sort(sort)
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
            Media.countDocuments({ userId }),
            user.storageUsed || 0
        ]);

        return {
            ...user,
            stats: {
                entries: entryCount,
                media: mediaCount,
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
    async deleteUser(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        logger.warn(`Admin initiating CASCADE DELETE for user ${userId} (${user.email})`);

        const deletedCounts: Record<string, number> = {};

        try {
            // Use services to delete user data
            deletedCounts.entries = await entryService.deleteUserData(userId);
            deletedCounts.entities = await entityService.deleteUserData(userId);
            deletedCounts.tags = await tagService.deleteUserData(userId);
            deletedCounts.media = await mediaService.deleteUserData(userId);
            deletedCounts.folders = await folderService.deleteUserData(userId);

            deletedCounts.goals = await goalService.deleteUserData(userId);
            deletedCounts.reminders = await reminderService.deleteUserData(userId);
            deletedCounts.notifications = await notificationService.deleteUserData(userId);
            deletedCounts.webActivity = await webActivityService.deleteUserData(userId);

            // Finally, delete the user
            await User.findByIdAndDelete(userId);

            logger.info(`User ${userId} (${user.email}) and all associated data deleted successfully`, deletedCounts);

            return {
                success: true,
                deletedCounts
            };
        } catch (error) {
            logger.error('Error during user cascade delete:', error);
            throw new Error(`Failed to delete user and associated data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

export const usersAdminService = new UsersAdminService();
