import { IEntry } from '../entry/entry.interfaces';
import { IGoal } from '../goal/goal.interfaces';
import { ReminderResponse } from '../reminder/reminder.types';

export interface GlobalSearchRequest {
    q: string;
    mode?: 'instant' | 'deep' | 'hybrid';
    limit?: number;
    collections?: ('entries' | 'goals' | 'reminders' | 'entities' | 'tags')[];
}

export interface GlobalSearchResponse {
    entries: IEntry[];
    goals: IGoal[];
    reminders: ReminderResponse[];
    entities?: any[];
    tags?: any[];
    total: number;
}
