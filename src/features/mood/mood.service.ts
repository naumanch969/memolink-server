import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { CreateMoodRequest, IMoodService, MoodFilter } from './mood.interfaces';
import Mood from './mood.model';

export class MoodService implements IMoodService {
    /**
     * Normalizes a date to YYYY-MM-DD 00:00:00 UTC
     */
    private normalizeDate(date: Date | string): Date {
        // If it's a string in YYYY-MM-DD format, append T00:00:00Z to force UTC
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return new Date(`${date}T00:00:00Z`);
        }

        const normalized = new Date(date);
        normalized.setUTCHours(0, 0, 0, 0);
        return normalized;
    }

    async upsertMood(userId: string | Types.ObjectId, data: CreateMoodRequest) {
        try {
            const normalizedDate = this.normalizeDate(data.date);

            const mood = await Mood.findOneAndUpdate(
                {
                    userId: new Types.ObjectId(userId),
                    date: normalizedDate
                },
                {
                    score: data.score,
                    note: data.note
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            logger.info('Mood upserted successfully', { userId, date: normalizedDate });
            return mood;
        } catch (error) {
            logger.error('Mood upsert failed:', error);
            throw error;
        }
    }

    async getMoods(userId: string | Types.ObjectId, filter: MoodFilter = {}) {
        try {
            const query: any = { userId: new Types.ObjectId(userId) };

            if (filter.dateFrom || filter.dateTo) {
                query.date = {};
                if (filter.dateFrom) query.date.$gte = this.normalizeDate(new Date(filter.dateFrom));
                if (filter.dateTo) query.date.$lte = this.normalizeDate(new Date(filter.dateTo));
            }

            return await Mood.find(query).sort({ date: -1 });
        } catch (error) {
            logger.error('Get moods failed:', error);
            throw error;
        }
    }

    async deleteMood(userId: string | Types.ObjectId, date: Date) {
        try {
            const normalizedDate = this.normalizeDate(date);
            return await Mood.findOneAndDelete({
                userId: new Types.ObjectId(userId),
                date: normalizedDate
            });
        } catch (error) {
            logger.error('Delete mood failed:', error);
            throw error;
        }
    }

    /**
     * Recalculates the daily average mood score based on all entries for a specific day.
     * This ensures the daily mood reflects the cumulative state of journal entries.
     */
    async recalculateDailyMoodFromEntries(userId: string | Types.ObjectId, date: Date): Promise<void> {
        try {
            // We use dynamic import for the model if needed, but since it's a model it's usually fine
            const { Entry } = await import('../entry/entry.model');
            const { classifyMood } = await import('../entry/mood.config');

            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const entries = await Entry.find({
                userId: new Types.ObjectId(userId),
                date: { $gte: startOfDay, $lte: endOfDay },
                mood: { $exists: true, $ne: '' }
            }).select('mood');

            if (entries.length === 0) return;

            let totalScore = 0;
            let count = 0;

            for (const entry of entries) {
                if (!entry.mood) continue;
                const config = classifyMood(entry.mood);
                if (config && config.score > 0) {
                    totalScore += config.score;
                    count++;
                }
            }

            if (count === 0) return;

            const avgScore = Math.round(totalScore / count);
            const clampedScore = Math.min(5, Math.max(1, avgScore));

            await this.upsertMood(userId, {
                date: startOfDay,
                score: clampedScore,
                note: `Auto-calculated from ${count} journal entries`
            });

        } catch (error) {
            logger.error(`Failed to recalculate daily mood for user ${userId}:`, error);
        }
    }
}

export const moodService = new MoodService();
export default moodService;
