import { USER_ROLES } from '../../shared/constants';

export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES];

export enum SocketEvents {
    // Connection
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',

    // Notifications
    NOTIFICATION_NEW = 'notification:new',

    // Announcements
    ANNOUNCEMENT_CREATED = 'announcement:created',
    ANNOUNCEMENT_UPDATED = 'announcement:updated',
    ANNOUNCEMENT_DISPATCH_PROGRESS = 'announcement:dispatch_progress',
    ANNOUNCEMENT_COMPLETED = 'announcement:completed',

    // Job Progress
    JOB_PROGRESS = 'job:progress',
    JOB_COMPLETED = 'job:completed',
    JOB_FAILED = 'job:failed',

    // System
    SYSTEM_HEALTH_UPDATE = 'system:health_update'
}

export interface SocketData {
    userId: string;
    role: UserRoleType;
}
