import { Types } from "mongoose";

export enum EventType {
    // 1. System & Lifecycle
    SESSION_START = 'session_start',
    SESSION_END = 'session_end',
    HEARTBEAT = 'heartbeat',

    // 2. Intent & Action
    TASK_CREATED = 'task_created',
    TASK_COMPLETED = 'task_completed',
    TASK_RESCHEDULED = 'task_rescheduled',
    TASK_ABANDONED = 'task_abandoned',
    GOAL_PROGRESS = 'goal_progress',
    INTENT_PROCESS_REQUESTED = 'intent_process_requested',

    // 3. Context Signals
    FOCUS_ENTERED = 'focus_entered',
    DISTRACTION_DETECTED = 'distraction_detected',
    LOCATION_CHANGED = 'location_changed',
    MOOD_LOGGED = 'mood_logged',

    // 4. Interaction
    MESSAGE_SENT = 'message_sent',
    CLARIFICATION_NEEDED = 'clarification_needed'
}

export interface AccessContext {
    deviceId: string;
    platform: 'web' | 'mobile' | 'ext' | 'server';
    version: string;
}

export interface MemolinkEvent<T = any> {
    id: string;           // UUIDv4
    type: EventType;
    timestamp: number;    // UTC Epoch
    userId: string | Types.ObjectId;       // The owner of the event
    source: AccessContext;
    payload: T;
    meta?: {
        is_offline_capture?: boolean;
        [key: string]: any;
    };
}

// Payload Types (Strict Enforcement)

export interface TaskRescheduledPayload {
    taskId: string;
    oldDate: string; // ISO String
    newDate: string; // ISO String
    reason?: string;
}

export interface FocusEnteredPayload {
    appName: string;
    windowTitle?: string;
}

export interface DistractionDetectedPayload {
    appName: string;
    durationSec: number;
}
