import { Types } from "mongoose";
import { CreateNotificationDTO, INotificationDocument } from "./notification.types";

export interface INotificationService {
    create(data: CreateNotificationDTO): Promise<INotificationDocument>;
    getUserNotifications(userId: string | Types.ObjectId, limit?: number, offset?: number, unreadOnly?: boolean): Promise<{ notifications: any[]; total: number; unreadCount: number }>;
    markAsRead(userId: string | Types.ObjectId, notificationId: string): Promise<void>;
    markAllAsRead(userId: string | Types.ObjectId): Promise<void>;
    delete(userId: string | Types.ObjectId, notificationId: string): Promise<void>;
    deleteUserData(userId: string | Types.ObjectId): Promise<number>;
    cleanupOldNotifications(): Promise<number>;
    registerPushToken(userId: string | Types.ObjectId, token: string, platform: string): Promise<void>;
}
