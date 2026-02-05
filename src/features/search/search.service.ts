import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { entryService } from '../entry/entry.service';
import Goal from '../goal/goal.model';
import { Reminder } from '../reminder/reminder.model';
import { GlobalSearchRequest, GlobalSearchResponse } from './search.interfaces';

export class SearchService {
    async globalSearch(userId: string, params: GlobalSearchRequest): Promise<GlobalSearchResponse> {
        const { q, limit = 10, mode = 'instant', collections = ['entries', 'goals', 'reminders'] } = params;
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
                entryService.searchEntries(userId, { q, limit, mode })
                    .then(res => {
                        results.entries = res.entries;
                        results.total += res.total;
                    })
                    .catch(err => logger.error('Entry search failed', err))
            );
        }

        if (collections.includes('goals')) {
            searchPromises.push(
                Goal.find({
                    userId: userIdObj,
                    $text: { $search: q }
                })
                    .select({ score: { $meta: 'textScore' } })
                    .sort({ score: { $meta: 'textScore' } })
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
            searchPromises.push(
                Reminder.find({
                    userId: userIdObj,
                    $text: { $search: q }
                })
                    .select({ score: { $meta: 'textScore' } })
                    .sort({ score: { $meta: 'textScore' } })
                    .limit(limit)
                    .lean()
                    .then(res => {
                        results.reminders = res as any;
                        results.total += res.length;
                    })
                    .catch(err => logger.error('Reminder search failed', err))
            );
        }

        await Promise.all(searchPromises);

        return results;
    }
}

export const searchService = new SearchService();
