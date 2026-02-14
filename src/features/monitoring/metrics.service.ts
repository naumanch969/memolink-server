import mongoose, { Document, Schema } from 'mongoose';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { logger } from '../../config/logger';

// --- MongoDB Persistence for System Metrics (Estimated Usage) ---

export interface ISystemMetric extends Document {
    key: string;
    count: number;
    metadata?: Record<string, any>;
    lastUpdatedAt: Date;
}

const SystemMetricSchema = new Schema<ISystemMetric>({
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
    lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const SystemMetric = mongoose.model<ISystemMetric>('SystemMetric', SystemMetricSchema);

// --- Prometheus Metrics Service ---

export class MetricService {
    private registry: Registry;

    // HTTP Metrics
    public httpRequestDuration: Histogram;
    public httpRequestTotal: Counter;
    public httpRequestErrors: Counter;

    // Database Metrics
    public dbQueryDuration: Histogram;
    public dbQueryTotal: Counter;

    // Custom Counters (Internal Usage)
    public entriesCreated: Counter;

    constructor() {
        this.registry = new Registry();
        collectDefaultMetrics({
            register: this.registry,
            prefix: 'memolink_',
        });

        // Initialize Prometheus Metrics
        this.httpRequestDuration = new Histogram({
            name: 'memolink_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        this.httpRequestTotal = new Counter({
            name: 'memolink_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.registry],
        });

        this.httpRequestErrors = new Counter({
            name: 'memolink_http_request_errors_total',
            help: 'Total number of HTTP request errors',
            labelNames: ['method', 'route', 'error_type'],
            registers: [this.registry],
        });

        this.dbQueryDuration = new Histogram({
            name: 'memolink_db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'collection'],
            registers: [this.registry],
        });

        this.dbQueryTotal = new Counter({
            name: 'memolink_db_queries_total',
            help: 'Total number of database queries',
            labelNames: ['operation', 'collection'],
            registers: [this.registry],
        });

        this.entriesCreated = new Counter({
            name: 'memolink_entries_created_total',
            help: 'Total number of entries created',
            registers: [this.registry],
        });
    }

    // Static helper for quick persistence (MongoDB)
    static async increment(key: string, amount: number = 1) {
        try {
            await SystemMetric.findOneAndUpdate(
                { key },
                {
                    $inc: { count: amount },
                    $set: { lastUpdatedAt: new Date() }
                },
                { upsert: true }
            );
        } catch (err) {
            logger.error(`Failed to increment metric ${key}`, err);
        }
    }

    static async set(key: string, value: number) {
        try {
            await SystemMetric.findOneAndUpdate(
                { key },
                { $set: { count: value, lastUpdatedAt: new Date() } },
                { upsert: true }
            );
        } catch (err) {
            console.error(`Failed to update metric ${key}:`, err);
        }
    }

    // Prometheus Recording Methods (Instance methods)
    public recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
        this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
        this.httpRequestTotal.inc({ method, route, status_code: statusCode });
        if (statusCode >= 400) {
            this.httpRequestErrors.inc({ method, route, error_type: statusCode >= 500 ? 'server_error' : 'client_error' });
        }
    }

    public recordDbQuery(operation: string, collection: string, duration: number) {
        this.dbQueryDuration.observe({ operation, collection }, duration);
        this.dbQueryTotal.inc({ operation, collection });
    }

    public async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    public async getMetricsJSON(): Promise<any> {
        return this.registry.getMetricsAsJSON();
    }
}

export const metricsService = new MetricService();
