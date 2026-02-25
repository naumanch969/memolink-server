import { Types } from 'mongoose';
import { CreateMoodRequest, IMoodDocument, MoodFilter } from "./mood.types";

export interface IMoodService {
    upsertMood(userId: string | Types.ObjectId, data: CreateMoodRequest): Promise<IMoodDocument>;
    getMoods(userId: string | Types.ObjectId, filter?: MoodFilter): Promise<IMoodDocument[]>;
    deleteMood(userId: string | Types.ObjectId, date: Date): Promise<IMoodDocument | null>;
    recalculateDailyMoodFromEntries(userId: string | Types.ObjectId, date: Date): Promise<void>;
}

