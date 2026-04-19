
import mongoose from 'mongoose';
import { logger } from '../../config/logger';
import { BadgeDefinition, UserBadge } from './badge.model';
import { BadgeStatus } from './badge.types';
import { IBadgeDefinition, IUserBadge } from './badge.interfaces';
import { INITIAL_BADGES } from './badge.registry';
import { getEmailQueue } from '../email/queue/email.queue';
import { User } from '../auth/auth.model';
import { config } from '../../config/env';

export class BadgeService {
    /**
     * Seeds initial badges if they don't exist
     */
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

    /**
     * Get all available badge definitions (visible to public)
     */
    async getAvailableBadges(): Promise<IBadgeDefinition[]> {
        return BadgeDefinition.find({ 
            status: { $in: [BadgeStatus.LIVE, BadgeStatus.EXPIRED] }
        }).lean();
    }

    /**
     * Get badges earned by a user
     */
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

    /**
     * Award a badge to a user
     */
    async awardBadge(userId: string, badgeId: string, metadata?: any): Promise<IUserBadge> {
        // 1. Check if badge definition exists
        const definition = await BadgeDefinition.findOne({ badgeId });
        if (!definition) {
            throw new Error(`Badge definition not found for ID: ${badgeId}`);
        }

        // 2. Check if user exists
        const user = await User.findById(new mongoose.Types.ObjectId(userId));
        if (!user) {
            throw new Error('User not found');
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
            const emailQueue = getEmailQueue();

            await emailQueue.add('send-email', {
                type: 'BADGE_UNLOCKED',
                data: {
                    to: user.email,
                    userName: user.name,
                    badgeName: definition.name,
                    badgeDescription: definition.description,
                    badgeId: definition.badgeId,
                    rarity: definition.rarity
                }
            });
            logger.info(`Badge ${badgeId} awarded to ${user.email} and notification queued.`);
        } catch (emailError) {
            logger.error('Failed to queue badge notification email:', emailError);
            // Don't fail the awarding if email fails
        }

        return awardedBadge;
    }

    /**
     * Get all badge definitions for admin
     */
    async getAllBadgesAdmin(): Promise<IBadgeDefinition[]> {
        return BadgeDefinition.find().sort({ category: 1, rarity: 1 }).lean();
    }

    /**
     * Create a new badge definition
     */
    async createBadge(data: Partial<IBadgeDefinition>): Promise<IBadgeDefinition> {
        return BadgeDefinition.create(data);
    }

    /**
     * Update an existing badge definition
     */
    async updateBadge(badgeId: string, data: Partial<IBadgeDefinition>): Promise<IBadgeDefinition | null> {
        return BadgeDefinition.findOneAndUpdate(
            { badgeId },
            { $set: data },
            { new: true }
        );
    }

    /**
     * Delete a badge definition
     */
    async deleteBadge(badgeId: string): Promise<boolean> {
        const result = await BadgeDefinition.deleteOne({ badgeId });
        return result.deletedCount > 0;
    }

    /**
     * Get badge achievement statistics
     */
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
