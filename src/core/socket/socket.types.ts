import { USER_ROLES } from '../../shared/constants';

export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES];

export enum SocketEvents {
    // Connection
    CONNECT = 'connection',
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

    // Agent Tasks
    AGENT_TASK_UPDATED = 'agent_task:updated',

    // Web Activity
    WEB_ACTIVITY_UPDATED = 'web_activity:updated',
    PASSIVE_SUMMARY_UPDATED = 'web_activity:summary_updated',

    // Reports
    REPORT_UPDATED = 'report:updated',

    // Entries Events
    ENTRY_CREATED = 'entry:created',
    ENTRY_UPDATED = 'entry:updated',

    // Partner Events
    PARTNER_RESPONSE_START = 'partner:response_start',
    PARTNER_RESPONSE_CHUNK = 'partner:response_chunk',
    PARTNER_RESPONSE_END = 'partner:response_end',

    // System
    SYSTEM_HEALTH_UPDATE = 'system:health_update',

    // Integrations
    INTEGRATION_WHATSAPP_LINKED = 'integration:whatsapp_linked'
}

export interface SocketData {
    userId: string;
    role: UserRoleType;
}

export interface ISocketService {
    setIo(io: any): void;
    initRedisBridge(subscriber: any): void;
    emitAll(event: SocketEvents, data: any): void;
    emitToUser(userId: string | any, event: SocketEvents, data: any): void;
    emitToRole(role: UserRoleType, event: SocketEvents, data: any): void;
    emitToRoom(room: string, event: SocketEvents, data: any): void;
}

