
import mongoose from 'mongoose';
import { logger } from '../../config/logger';
import { BadgeDefinition, UserBadge } from './badge.model';
import { BadgeStatus } from './badge.types';
import { IBadgeDefinition, IUserBadge } from './badge.interfaces';
import { INITIAL_BADGES } from './badge.registry';
import { emailService } from '../email/email.service';
import { User } from '../auth/auth.model';
import { notificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { Entry } from '../entry/entry.model';

export class BadgeService {
    // Seeds initial badges if they don't exist
    async seedBadges(): Promise<void> {
        for (const badgeData of INITIAL_BADGES) {
            await BadgeDefinition.findOneAndUpdate(
                { badgeId: badgeData.badgeId },
                {
                    ...badgeData,
                    status: badgeData.status
                },
                { upsert: true, new: true }
            );
        }
        logger.info('Badge registry seeded successfully');
    }

    // Get all available badge definitions (visible to public)
    async getAvailableBadges(): Promise<IBadgeDefinition[]> {
        return BadgeDefinition.find({
            status: { $in: [BadgeStatus.LIVE, BadgeStatus.EXPIRED] }
        }).lean();
    }

    // Get badges earned by a user
    async getUserBadges(userId: string): Promise<any[]> {
        const userBadges = await UserBadge.find({
            userId: new mongoose.Types.ObjectId(userId)
        }).lean();
        const definitions = await BadgeDefinition.find({
            badgeId: { $in: userBadges.map(ub => ub.badgeId) }
        }).lean();

        // Enrich user badges with definitions
        return userBadges.map(ub => ({
            ...ub,
            definition: definitions.find(d => d.badgeId === ub.badgeId)
        }));
    }

    // Award a badge to a user
    async awardBadge(userId: string, badgeId: string, metadata?: any): Promise<IUserBadge | null> {
        try {
            // 1. Check if badge definition exists
            const definition = await BadgeDefinition.findOne({ badgeId });
            if (!definition) {
                logger.warn(`Badge definition not found for ID: ${badgeId}`);
                return null;
            }

            // 2. Check if user exists
            const user = await User.findById(new mongoose.Types.ObjectId(userId));
            if (!user) {
                logger.warn(`User not found: ${userId}`);
                return null;
            }

            // 3. Award the badge (ensure uniqueness via upsert if needed, or check first)
            const existing = await UserBadge.findOne({
                userId: new mongoose.Types.ObjectId(userId),
                badgeId
            });
            if (existing) {
                return existing; // Already awarded
            }

            const awardedBadge = await UserBadge.create({
                userId: new mongoose.Types.ObjectId(userId),
                badgeId,
                metadata,
                awardedAt: new Date()
            });

            // 4. Send Email Notification
            try {
                await emailService.sendSystemEmail('BADGE_UNLOCKED', {
                    to: user.email,
                    userName: user.name,
                    badgeName: definition.name,
                    badgeDescription: definition.description,
                    badgeId: definition.badgeId,
                    rarity: definition.rarity
                }, userId);

                logger.info(`Badge ${badgeId} awarded to ${user.email} and notification email logged & queued.`);
            } catch (emailError) {
                logger.error('Failed to queue badge notification email:', emailError);
            }

            // 5. Create System Notification
            try {
                await notificationService.create({
                    userId: userId,
                    type: NotificationType.ACHIEVEMENT,
                    title: 'New Achievement Unlocked!',
                    message: `Congratulations! You've earned the ${definition.name} badge.`,
                    referenceId: awardedBadge._id as any,
                    referenceModel: 'UserBadge',
                    actionUrl: '/achievements'
                });
                logger.info(`Achievement notification created for user ${userId} (Badge: ${badgeId})`);
            } catch (notifError) {
                logger.error('Failed to create achievement notification:', notifError);
            }

            return awardedBadge;
        } catch (error) {
            logger.error(`Error awarding badge ${badgeId} to user ${userId}:`, error);
            return null;
        }
    }

    // Evaluates and awards potential achievements after a new entry is created.
    async handleEntryCreatedAchievements(userId: string): Promise<void> {
        try {
            const userObjectId = new mongoose.Types.ObjectId(userId);

            // 1. MILESTONE CHECKS
            const totalEntries = await Entry.countDocuments({ userId: userObjectId });

            if (totalEntries >= 1) await this.awardBadge(userId, 'first_thought');
            if (totalEntries >= 10) await this.awardBadge(userId, 'deca_thought');
            if (totalEntries >= 50) await this.awardBadge(userId, 'thought_weaver');
            if (totalEntries >= 100) await this.awardBadge(userId, 'memory_keeper');
            if (totalEntries >= 500) await this.awardBadge(userId, 'deep_archivist');
            if (totalEntries >= 1000) await this.awardBadge(userId, 'mind_vault');

            // 2. STREAK CHECKS
            await this.evaluateStreakAchievements(userId);

        } catch (error) {
            logger.error('Failed to handle entry achievements:', error);
        }
    }

    private async evaluateStreakAchievements(userId: string): Promise<void> {
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Get all entry dates for the last 30+ days
        const thirtyFiveDaysAgo = new Date();
        thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

        const recentEntries = await Entry.find({
            userId: userObjectId,
            createdAt: { $gte: thirtyFiveDaysAgo }
        }).select('createdAt').sort({ createdAt: -1 });

        if (recentEntries.length === 0) return;

        // Unique days set
        const daySet = new Set(recentEntries.map(e => e.createdAt.toISOString().split('T')[0]));

        let currentStreak = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Check if streak is active (took action today or yesterday)
        if (!daySet.has(todayStr) && !daySet.has(yesterdayStr)) {
            return; // Streak broken
        }

        // Calculate current streak
        const checkDate = new Date();
        if (!daySet.has(todayStr)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (daySet.has(checkDate.toISOString().split('T')[0])) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        if (currentStreak >= 7) await this.awardBadge(userId, 'streak_thinker');
        if (currentStreak >= 30) await this.awardBadge(userId, 'monthly_mindset');
    }

    // Get all badge definitions for admin
    async getAllBadgesAdmin(): Promise<IBadgeDefinition[]> {
        return BadgeDefinition.find().sort({ category: 1, rarity: 1 }).lean();
    }

    // Create a new badge definition
    async createBadge(data: Partial<IBadgeDefinition>): Promise<IBadgeDefinition> {
        return BadgeDefinition.create(data);
    }

    // Update an existing badge definition
    async updateBadge(badgeId: string, data: Partial<IBadgeDefinition>): Promise<IBadgeDefinition | null> {
        return BadgeDefinition.findOneAndUpdate(
            { badgeId },
            { $set: data },
            { new: true }
        );
    }

    // Delete a badge definition
    async deleteBadge(badgeId: string): Promise<boolean> {
        const result = await BadgeDefinition.deleteOne({ badgeId });
        return result.deletedCount > 0;
    }

    // Get badge achievement statistics
    async getBadgeStats(): Promise<any[]> {
        const stats = await UserBadge.aggregate([
            {
                $group: {
                    _id: '$badgeId',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    badgeId: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);
        return stats;
    }
}

export const badgeService = new BadgeService();
