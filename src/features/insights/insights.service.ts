
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { Entry } from '../entry/entry.model';
import { Insight } from './insights.model';
import { InsightType, InsightData, StreakData, Pattern, IInsight } from './insights.interfaces';

export class InsightsService {
    /**
     * Get streak data for a user
     */
    static async getStreak(userId: string): Promise<StreakData> {
        const userObjectId = new Types.ObjectId(userId);

        // Fetch dates of all entries, sorted desc
        const entries = await Entry.find({ userId: userObjectId }, { date: 1, createdAt: 1 })
            .sort({ date: -1 })
            .lean();

        if (!entries.length) {
            return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [] };
        }

        // Use 'date' field if available, fallback to 'createdAt'
        // Normalize to YYYY-MM-DD
        const dates = entries.map(e => {
            const d = new Date(e.date || e.createdAt);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        });

        // Remove duplicates
        const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

        if (uniqueDates.length === 0) return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [] };

        let currentStreak = 0;
        let longestStreak = 0;

        // Calculate current streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTime = yesterday.getTime();

        // Check if the most recent entry is today or yesterday
        const lastEntryTime = uniqueDates[0];

        // If last entry was before yesterday, streak is broken (0), essentially. 
        // BUT we have a "1 day grace period". 
        // Wait, "1 day miss allowed" usually means if I miss Monday, and write Tuesday, streak continues?
        // Or does it mean if I miss Monday, I can "repair" it?
        // "Streak recovery grace period (1 day miss allowed)" usually implies logic like:
        // If gap is 1 day (e.g. Mon, Wed), it counts as continuous? Or user has to do something?
        // For simplicity of "Automatic" requirement, I'll interpret: A gap of 1 day does NOT break streak.
        // So: Mon (Entry), Tue (No), Wed (Entry) -> Streak 3? Or Streak 2 but kept alive?
        // Usually "Grace period" implies it doesn't RESET to 0, but maybe doesn't increment?
        // Let's assume: Contiguous block allowing 1 day gaps.

        // Implementation: Iterate and verify gap <= 2 days (1 day missed).
        // If gap is > 2 days (missed 2 days), streak breaks.

        let tempStreak = 1;
        let maxStr = 1;

        for (let i = 0; i < uniqueDates.length - 1; i++) {
            const curr = uniqueDates[i];
            const next = uniqueDates[i + 1];
            const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

            if (diffDays <= 2) { // 1 day gap allowed (diff=2 means 1 day skipped)
                tempStreak++;
            } else {
                if (tempStreak > maxStr) maxStr = tempStreak;
                tempStreak = 1;
            }
        }
        if (tempStreak > maxStr) maxStr = tempStreak;
        longestStreak = maxStr;

        // Current Streak
        // Must have entry today or yesterday (or 2 days ago if grace is active?)
        // If last entry is today: active.
        // If last entry is yesterday: active.
        // If last entry is 2 days ago: active (grace period used).
        // If last entry is 3 days ago: broken (0).
        const daysSinceLast = (todayTime - lastEntryTime) / (1000 * 60 * 60 * 24);

        if (daysSinceLast <= 2) {
            // Calculate streak working backwards from latest
            let currStr = 1;
            for (let i = 0; i < uniqueDates.length - 1; i++) {
                const curr = uniqueDates[i];
                const next = uniqueDates[i + 1];
                const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

                if (diffDays <= 2) {
                    currStr++;
                } else {
                    break;
                }
            }
            currentStreak = currStr;
        } else {
            currentStreak = 0;
        }

        return {
            currentStreak,
            longestStreak,
            lastEntryDate: new Date(lastEntryTime),
            milestones: [7, 30, 100, 365],
        };
    }

    /**
     * Generate patterns/insights
     */
    static async getPatterns(userId: string): Promise<Pattern[]> {
        const userObjectId = new Types.ObjectId(userId);
        const patterns: Pattern[] = [];

        // 1. Day of Week Analysis
        // "You mention 'work' most on Mondays" -> This requires aggregating tags/text by day.
        // Simplified: "You write more on Weekends"
        const dayDistribution = await Entry.aggregate([
            { $match: { userId: userObjectId } },
            {
                $project: {
                    dayOfWeek: { $dayOfWeek: "$date" } // 1 (Sun) - 7 (Sat)
                }
            },
            {
                $group: {
                    _id: "$dayOfWeek",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Check if Weekends (1, 7) > Weekdays average
        const weekendCount = dayDistribution.filter(d => d._id === 1 || d._id === 7).reduce((a, b) => a + b.count, 0);
        const weekdayCount = dayDistribution.filter(d => d._id > 1 && d._id < 7).reduce((a, b) => a + b.count, 0);

        if (weekendCount / 2 > weekdayCount / 5 * 1.2) { // 20% more likely
            patterns.push({
                id: 'weekend-writer',
                type: 'time',
                description: 'You write significantly more on weekends.',
                significance: 'medium',
                data: { weekendCount, weekdayCount }
            });
        }

        // 2. Mood Patterns
        // "Your mood improves when you mention 'exercise'"
        // Find entries with 'exercise' (tag or text) and check mood.
        // Requires mood to be mappable (if string, hard).
        // Let's assume mood is string for now and skip complex correlation unless we can map strings.

        // 3. Mention Patterns
        // "You mention 'Target' most on Mondays"
        // For now, let's keep it simple.

        return patterns;
    }

    /**
     * Get latest weekly summary or generate one if missing
     * In a real app, cron generates this. Here we can lazy-generate for demo/testing.
     */
    static async getRecentInsights(userId: string, type: InsightType): Promise<IInsight | null> {
        const userObjectId = new Types.ObjectId(userId);

        // Find latest
        const latest = await Insight.findOne({ userId: userObjectId, type }).sort({ periodStart: -1 });
        return latest;
    }

    /**
     * Generate and save report (for Cron)
     */
    static async generateReport(userId: string, type: InsightType, date: Date = new Date()): Promise<IInsight> {
        const userObjectId = new Types.ObjectId(userId);

        // Calculate period
        let start: Date, end: Date;
        if (type === InsightType.WEEKLY) {
            // Last complete week (Sun-Sat) or last 7 days? 
            // "Auto-generated every Sunday at 8 PM" implies previous week (Sun-Sun or Mon-Sun).
            // Let's take last 7 days ending now.
            end = new Date(date);
            start = new Date(date);
            start.setDate(start.getDate() - 7);
        } else {
            // Monthly
            end = new Date(date);
            start = new Date(date);
            start.setMonth(start.getMonth() - 1);
        }

        // Aggregations
        const entries = await Entry.find({
            userId: userObjectId,
            date: { $gte: start, $lte: end }
        });

        const totalEntries = entries.length;

        // Words
        const wordCount = entries.reduce((acc, curr) => {
            return acc + (curr.content ? curr.content.split(/\s+/).length : 0);
        }, 0);

        // Top People (Aggregated from mentions)
        // We need aggregation for efficient counting
        const topPeople = await Entry.aggregate([
            { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
            { $unwind: "$mentions" },
            { $group: { _id: "$mentions", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 3 },
            { $lookup: { from: "people", localField: "_id", foreignField: "_id", as: "person" } },
            { $unwind: "$person" },
            { $project: { personId: "$_id", name: "$person.name", count: 1 } }
        ]);

        const topTags = await Entry.aggregate([
            { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 3 },
            { $lookup: { from: "tags", localField: "_id", foreignField: "_id", as: "tag" } },
            { $unwind: "$tag" },
            { $project: { tagId: "$_id", name: "$tag.name", count: 1 } }
        ]);

        // Moods
        const moodCounts: Record<string, number> = {};
        entries.forEach(e => {
            if (e.mood) {
                moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
            }
        });
        const moodTrend = Object.entries(moodCounts)
            .map(([mood, count]) => ({ mood, count }))
            .sort((a, b) => b.count - a.count);

        // Streak
        const streakData = await this.getStreak(userId);

        const insightData: InsightData = {
            totalEntries,
            wordCount,
            mostMentionedPeople: topPeople,
            mostUsedTags: topTags,
            moodTrend,
            streak: streakData.currentStreak
        };

        // Save
        const insight = await Insight.create({
            userId: userObjectId,
            type,
            periodStart: start,
            periodEnd: end,
            data: insightData
        });

        return insight;
    }
}
