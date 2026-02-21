import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { DateUtil } from '../../shared/utils/date.util';
import { PaginationUtil } from '../../shared/utils/pagination.util';
import { StringUtil } from '../../shared/utils/string.util';
import { EntrySearchRequest, IEntry } from './entry.interfaces';
import { Entry } from './entry.model';

export class EntrySearchService {
    /**
     * Main entry point for searching entries with support for multiple modes
     */
    async search(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
        try {
            const mode = searchParams.mode || 'instant';

            if (!searchParams.q?.trim()) {
                // Fallback to basic filtered list if no query string is provided
                // Note: This would usually call getUserEntries, but we'll implement a basic version here
                // to avoid circular dependencies if needed, or inject the service.
                return this.performKeywordSearch(userId, searchParams);
            }

            switch (mode) {
                case 'deep':
                    return this.performVectorSearch(userId, searchParams);
                case 'hybrid':
                    return this.performHybridSearch(userId, searchParams);
                case 'instant':
                default:
                    return this.performKeywordSearch(userId, searchParams);
            }
        } catch (error) {
            logger.error('Search entries failed:', error);
            throw error;
        }
    }

    /**
     * Tier 1: Fast Keyword Search using Regex or MongoDB Text Index
     */
    private async performKeywordSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
        const { page, limit, skip } = PaginationUtil.getPaginationParams(searchParams);
        let sort: any = PaginationUtil.getSortParams(searchParams, 'createdAt');

        const filter: any = { userId: new Types.ObjectId(userId) };
        const projection: any = {};

        if (searchParams.q) {
            const sanitizedQuery = StringUtil.sanitizeSearchQuery(searchParams.q);
            if (sanitizedQuery) {
                if (searchParams.mode === 'instant') {
                    filter.$or = [
                        { content: { $regex: sanitizedQuery, $options: 'i' } },
                        { mood: { $regex: sanitizedQuery, $options: 'i' } },
                        { location: { $regex: sanitizedQuery, $options: 'i' } }
                    ];
                } else {
                    filter.$text = { $search: sanitizedQuery };
                    projection.score = { $meta: 'textScore' };
                    sort = { score: { $meta: 'textScore' }, ...sort };
                }
            }
        }

        this.applyFilters(filter, searchParams);

        const [entries, total] = await Promise.all([
            Entry.find(filter, projection)
                .populate(['mentions', 'tags', 'media'])
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Entry.countDocuments(filter),
        ]);

        return { entries: entries as unknown as IEntry[], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Tier 2: Semantic (Vector) Search using Atlas Vector Search
     */
    private async performVectorSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
        const { page, limit, skip } = PaginationUtil.getPaginationParams(searchParams);

        if (!searchParams.q) return { entries: [], total: 0, page, limit, totalPages: 0 };

        const queryVector = await LLMService.generateEmbeddings(searchParams.q, {
            workflow: 'search_embeddings',
            userId,
        });

        const pipeline: any[] = [
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embeddings",
                    queryVector,
                    numCandidates: 100,
                    limit: 50,
                    filter: { userId: new Types.ObjectId(userId) }
                }
            },
            {
                $addFields: { score: { $meta: "vectorSearchScore" } }
            }
        ];

        const filter: any = {};
        this.applyFilters(filter, searchParams);
        if (Object.keys(filter).length > 0) {
            pipeline.push({ $match: filter });
        }

        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        const entries = await Entry.aggregate(pipeline);
        await Entry.populate(entries, 'mentions tags media');

        return {
            entries: entries as unknown as IEntry[],
            total: entries.length,
            page,
            limit,
            totalPages: 1
        };
    }

    /**
     * Tier 3: Hybrid Search combining Keyword and Vector results using RRF
     */
    private async performHybridSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
        const { page, limit } = PaginationUtil.getPaginationParams(searchParams);

        const keywordPromise = this.performKeywordSearch(userId, { ...searchParams, limit: 50, page: 1, mode: 'instant' });
        const vectorPromise = this.performVectorSearch(userId, { ...searchParams, limit: 50, page: 1, mode: 'deep' }).catch(err => {
            logger.warn('Vector search failed in hybrid mode', { error: err.message });
            return { entries: [], total: 0, page: 1, limit: 50, totalPages: 0 };
        });

        const [keywordRes, vectorRes] = await Promise.all([keywordPromise, vectorPromise]);

        if (keywordRes.entries.length === 0 && vectorRes.entries.length === 0) {
            return { entries: [], total: 0, page, limit, totalPages: 0 };
        }

        const mixedEntries = this.applyRRF(keywordRes.entries, vectorRes.entries, limit);

        return {
            entries: mixedEntries,
            total: Math.max(keywordRes.total, mixedEntries.length),
            page,
            limit,
            totalPages: 1
        };
    }

    /**
     * Common helper to apply query filters to search filter objects
     */
    private applyFilters(filter: any, searchParams: EntrySearchRequest) {
        if (searchParams.type) filter.type = searchParams.type;

        if (searchParams.dateFrom || searchParams.dateTo) {
            const { from, to } = DateUtil.getDateRange(searchParams.dateFrom, searchParams.dateTo);
            filter.date = {};
            if (from) filter.date.$gte = from;
            if (to) filter.date.$lte = to;
        }

        if (searchParams.tags && searchParams.tags.length > 0) {
            filter.tags = { $in: searchParams.tags.map(id => new Types.ObjectId(id)) };
        }

        if (searchParams.entities && searchParams.entities.length > 0) {
            filter.mentions = { $in: searchParams.entities.map(id => new Types.ObjectId(id)) };
        }

        if (searchParams.isPrivate !== undefined) filter.isPrivate = searchParams.isPrivate;
        if (searchParams.isImportant !== undefined) filter.isImportant = searchParams.isImportant;
        if (searchParams.isFavorite !== undefined) filter.isFavorite = searchParams.isFavorite;
        if (searchParams.mood) filter.mood = new RegExp(searchParams.mood, 'i');
        if (searchParams.location) filter.location = new RegExp(searchParams.location, 'i');
    }

    /**
     * Reciprocal Rank Fusion (RRF) algorithm to merge multiple result sets
     */
    private applyRRF(keywordResults: any[], vectorResults: any[], limit: number, k: number = 60): any[] {
        const scores: Record<string, { entry: any; score: number }> = {};

        keywordResults.forEach((entry, index) => {
            const id = entry._id.toString();
            const score = 1 / (k + index + 1);
            scores[id] = { entry, score };
        });

        vectorResults.forEach((entry, index) => {
            const id = entry._id.toString();
            const score = 1 / (k + index + 1);
            if (scores[id]) {
                scores[id].score += score;
            } else {
                scores[id] = { entry, score };
            }
        });

        return Object.values(scores)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.entry);
    }
}

export const entrySearchService = new EntrySearchService();
