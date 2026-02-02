import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { CreateMoodRequest, MoodFilter } from './mood.interfaces';
import Mood from './mood.model';

export class MoodService {
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

    async upsertMood(userId: string, data: CreateMoodRequest) {
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

    async getMoods(userId: string, filter: MoodFilter = {}) {
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

    async deleteMood(userId: string, date: Date) {
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
}

export const moodService = new MoodService();
export default moodService;
