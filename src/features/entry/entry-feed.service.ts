import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { EntryFeedRequest, IEntry } from './entry.interfaces';
import { Entry } from './entry.model';

export class EntryFeedService {
    /**
     * Fetches the user's feed using cursor-based pagination
     */
    async getFeed(userId: string, feedParams: EntryFeedRequest): Promise<{ entries: IEntry[]; nextCursor?: string; hasMore: boolean; }> {
        try {
            const limit = Math.min(Math.max(1, feedParams.limit || 20), 50);
            const filter: any = { userId: new Types.ObjectId(userId) };

            if (feedParams.cursor) {
                const cursorEntry = await Entry.findById(feedParams.cursor);
                if (cursorEntry) {
                    filter.$or = [
                        { createdAt: { $lt: cursorEntry.createdAt } },
                        {
                            createdAt: cursorEntry.createdAt,
                            _id: { $lt: cursorEntry._id }
                        }
                    ];
                }
            }

            this.applyFeedFilters(filter, feedParams);

            const entries = await Entry.find(filter)
                .populate(['mentions', 'tags', 'media'])
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .lean();

            const hasMore = entries.length > limit;
            let nextCursor = undefined;

            if (hasMore) {
                entries.pop();
                nextCursor = entries[entries.length - 1]._id.toString();
            }

            return {
                entries: entries as unknown as IEntry[],
                nextCursor,
                hasMore
            };
        } catch (error) {
            logger.error('Get feed failed:', error);
            throw error;
        }
    }

    /**
     * Applies secondary filters like tags, mood, etc. to the feed query
     */
    private applyFeedFilters(filter: any, params: EntryFeedRequest) {
        if (params.type) filter.type = params.type;

        if (params.tags && params.tags.length > 0) {
            filter.tags = { $in: params.tags.map((id: string) => new Types.ObjectId(id)) };
        }

        if (params.entities && params.entities.length > 0) {
            filter.mentions = { $in: params.entities.map((id: string) => new Types.ObjectId(id)) };
        }

        if (params.isPrivate !== undefined) filter.isPrivate = params.isPrivate;
        if (params.isImportant !== undefined) filter.isImportant = params.isImportant;

        if (params.mood) {
            filter.mood = new RegExp(params.mood, 'i');
        }
    }
}

export const entryFeedService = new EntryFeedService();
