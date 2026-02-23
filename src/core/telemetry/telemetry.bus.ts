import { EventEmitter } from 'events';
import { Types } from 'mongoose';

export enum TelemetryEvent {
    AI_REQUEST_COMPLETED = 'ai_request_completed',
    HTTP_REQUEST_COMPLETED = 'http_request_completed',
    DB_QUERY_COMPLETED = 'db_query_completed',
    SYSTEM_METRIC_UPDATE = 'system_metric_update',
    STORAGE_USAGE_UPDATE = 'storage_usage_update',
}

export interface AIUsagePayload {
    model: string;
    promptTokens: number;
    completionTokens: number;
    feature?: string;
    userId?: string | Types.ObjectId;
}

export interface HTTPUsagePayload {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
    responseTime: number;
    egressBytes?: number;
}

export interface DBUsagePayload {
    operation: string;
    collection: string;
    duration: number;
    documentSize?: number;
}

export interface MetricPayload {
    key: string;
    value: number;
    op?: 'sum' | 'max' | 'set'; // Default to 'sum'
    metadata?: Record<string, any>;
}

class TelemetryBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20);
    }

    // Typed emits for better DX
    emitAI(payload: AIUsagePayload) {
        this.emit(TelemetryEvent.AI_REQUEST_COMPLETED, payload);
    }

    emitHTTP(payload: HTTPUsagePayload) {
        this.emit(TelemetryEvent.HTTP_REQUEST_COMPLETED, payload);
    }

    emitDB(payload: DBUsagePayload) {
        this.emit(TelemetryEvent.DB_QUERY_COMPLETED, payload);
    }

    emitMetric(payload: MetricPayload) {
        this.emit(TelemetryEvent.SYSTEM_METRIC_UPDATE, payload);
    }
}

export const telemetryBus = new TelemetryBus();
