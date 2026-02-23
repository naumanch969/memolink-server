import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { KnowledgeEntity } from '../entity/entity.model';
import { entryService } from '../entry/entry.service';
import Goal from '../goal/goal.model';
import { Reminder } from '../reminder/reminder.model';
import { GlobalSearchRequest, GlobalSearchResponse, ISearchService } from './search.interfaces';

export class SearchService implements ISearchService {
    async globalSearch(userId: string, params: GlobalSearchRequest): Promise<GlobalSearchResponse> {
        const { q, limit = 10, mode = 'instant', collections = ['entries', 'goals', 'reminders', 'entities'], filters } = params;
        const userIdObj = new Types.ObjectId(userId);

        const results: GlobalSearchResponse = {
            entries: [],
            goals: [],
            reminders: [],
            total: 0
        };

        const searchPromises: Promise<any>[] = [];

        if (collections.includes('entries')) {
            searchPromises.push(
                entryService.searchEntries(userId, { q, limit, mode, ...filters })
                    .then(res => {
                        results.entries = res.entries;
                        results.total += res.total;
                    })
                    .catch(err => logger.error('Entry search failed', err))
            );
        }

        if (collections.includes('goals')) {
            const goalFilter: any = { userId: userIdObj };
            const goalProjection: any = {};
            let goalSort: any = { createdAt: -1 };

            if (mode === 'instant' || mode === 'hybrid') {
                goalFilter.$or = [
                    { title: { $regex: q, $options: 'i' } },
                    { description: { $regex: q, $options: 'i' } },
                    { why: { $regex: q, $options: 'i' } }
                ];
            } else {
                goalFilter.$text = { $search: q };
                goalProjection.score = { $meta: 'textScore' };
                goalSort = { score: { $meta: 'textScore' } };
            }

            searchPromises.push(
                Goal.find(goalFilter, goalProjection)
                    .sort(goalSort)
                    .limit(limit)
                    .lean()
                    .then(res => {
                        results.goals = res as any;
                        results.total += res.length;
                    })
                    .catch(err => logger.error('Goal search failed', err))
            );
        }

        if (collections.includes('reminders')) {
            const reminderFilter: any = { userId: userIdObj };
            const reminderProjection: any = {};
            let reminderSort: any = { createdAt: -1 };

            if (mode === 'instant' || mode === 'hybrid') {
                reminderFilter.$or = [
                    { title: { $regex: q, $options: 'i' } },
                    { description: { $regex: q, $options: 'i' } }
                ];
            } else {
                reminderFilter.$text = { $search: q };
                reminderProjection.score = { $meta: 'textScore' };
                reminderSort = { score: { $meta: 'textScore' } };
            }

            searchPromises.push(
                Reminder.find(reminderFilter, reminderProjection)
                    .sort(reminderSort)
                    .limit(limit)
                    .lean()
                    .then(res => {
                        results.reminders = res as any;
                        results.total += res.length;
                    })
                    .catch(err => logger.error('Reminder search failed', err))
            );
        }

        if (collections.includes('entities')) {
            searchPromises.push(
                KnowledgeEntity.find({
                    userId: userIdObj,
                    isDeleted: false,
                    $or: [
                        { name: { $regex: q, $options: 'i' } },
                        { aliases: { $regex: q, $options: 'i' } },
                        { tags: { $regex: q, $options: 'i' } }
                    ]
                })
                    .sort({ interactionCount: -1 })
                    .limit(limit)
                    .lean()
                    .then(res => {
                        results.entities = res as any;
                        results.total += res.length;
                    })
                    .catch(err => logger.error('Entity search failed', err))
            );
        }

        await Promise.all(searchPromises);

        return results;
    }
}

export const searchService = new SearchService();
