
import { logger } from '../../config/logger';
import { BadgeDefinition, UserBadge, IBadgeDefinition, IUserBadge } from './badge.model';
import { INITIAL_BADGES } from './badge.registry';
import { getEmailQueue } from '../email/queue/email.queue';
import { User } from '../auth/auth.model';

export class BadgeService {
    /**
     * Seeds initial badges if they don't exist
     */
    async seedBadges(): Promise<void> {
        for (const badgeData of INITIAL_BADGES) {
            await BadgeDefinition.findOneAndUpdate(
                { badgeId: badgeData.badgeId },
                badgeData,
                { upsert: true, new: true }
            );
        }
        logger.info('Badge registry seeded successfully');
    }

    /**
     * Get all available badge definitions
     */
    async getAvailableBadges(): Promise<IBadgeDefinition[]> {
        return BadgeDefinition.find({ isEnabled: true }).lean();
    }

    /**
     * Get badges earned by a user
     */
    async getUserBadges(userId: string): Promise<any[]> {
        const userBadges = await UserBadge.find({ userId }).lean();
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
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // 3. Award the badge (ensure uniqueness via upsert if needed, or check first)
        const existing = await UserBadge.findOne({ userId, badgeId });
        if (existing) {
            return existing; // Already awarded
        }

        const awardedBadge = await UserBadge.create({
            userId,
            badgeId,
            metadata,
            awardedAt: new Date()
        });

        // 4. Send Email Notification
        try {
            const emailQueue = getEmailQueue();
            await emailQueue.add('send-email', {
                type: 'GENERIC', // Use Generic for now if BADGE_UNLOCKED isn't in worker yet
                data: {
                    to: user.email,
                    subject: `🎉 Achievement Unlocked: ${definition.name}!`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px;">
                            <h2>Congratulations, ${user.name}!</h2>
                            <p>You've just earned a new badge on Brinn:</p>
                            <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0;">
                                <h3 style="margin: 0; color: #f97316;">${definition.name}</h3>
                                <p style="color: #64748b;">${definition.description}</p>
                            </div>
                            <p>Keep exploring to unlock more milestones!</p>
                            <a href="${process.env.FRONTEND_URL}/achievements" style="background: #0f172a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View My Badges</a>
                        </div>
                    `
                }
            });
            logger.info(`Badge ${badgeId} awarded to ${user.email} and notification queued.`);
        } catch (emailError) {
            logger.error('Failed to queue badge notification email:', emailError);
            // Don't fail the awarding if email fails
        }

        return awardedBadge;
    }
}

export const badgeService = new BadgeService();
