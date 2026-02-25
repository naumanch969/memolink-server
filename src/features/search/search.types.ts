import { IEntry } from "../entry/entry.types";
import { IGoal } from "../goal/goal.types";
import { ReminderResponse } from "../reminder/reminder.types";

export interface GlobalSearchRequest {
    q: string;
    mode?: 'instant' | 'deep' | 'hybrid';
    limit?: number;
    collections?: ('entries' | 'goals' | 'reminders' | 'entities' | 'tags')[];
    filters?: any;
}

export interface GlobalSearchResponse {
    entries: IEntry[];
    goals: IGoal[];
    reminders: ReminderResponse[];
    entities?: any[];
    tags?: any[];
    total: number;
}
