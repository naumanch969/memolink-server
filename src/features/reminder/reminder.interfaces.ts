import { Types } from "mongoose";
import { CreateReminderRequest, GetRemindersQuery, GetRemindersResponse, ReminderResponse, UpdateReminderRequest } from "./reminder.types";

export interface IReminderService {
    createReminder(userId: string | Types.ObjectId, data: CreateReminderRequest): Promise<ReminderResponse>;
    getReminders(userId: string | Types.ObjectId, query: GetRemindersQuery): Promise<GetRemindersResponse>;
    getReminderById(userId: string | Types.ObjectId, reminderId: string): Promise<ReminderResponse>;
    getUpcomingReminders(userId: string | Types.ObjectId, limit?: number): Promise<ReminderResponse[]>;
    getOverdueReminders(userId: string | Types.ObjectId): Promise<ReminderResponse[]>;
    updateReminder(userId: string | Types.ObjectId, reminderId: string, data: UpdateReminderRequest): Promise<ReminderResponse>;
    completeReminder(userId: string | Types.ObjectId, reminderId: string, completedAt?: Date): Promise<ReminderResponse>;
    cancelReminder(userId: string | Types.ObjectId, reminderId: string): Promise<ReminderResponse>;
    deleteReminder(userId: string | Types.ObjectId, reminderId: string): Promise<void>;
    deleteUserData(userId: string | Types.ObjectId): Promise<number>;
}
