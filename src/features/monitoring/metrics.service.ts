import os from 'os';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { telemetryBus } from '../../core/telemetry/telemetry.bus';

// --- Prometheus Metrics Service ---
 
export class MetricsService {
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

    // Static helper for quick persistence (via Telemetry Buffer)
    static startSystemMetricsCollection() {
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            // Memory in MB
            telemetryBus.emitMetric({ key: 'system:memory:heap', value: Math.round(memoryUsage.heapUsed / 1024 / 1024), op: 'max' });
            telemetryBus.emitMetric({ key: 'system:memory:rss', value: Math.round(memoryUsage.rss / 1024 / 1024), op: 'max' });

            // CPU Load (approx) - sending user time as proxy for load activity
            // Since cpuUsage is since boot, we'd need diff. But loadavg is easier for OS level.
            const load = os.loadavg()[0]; // 1 min load average
            telemetryBus.emitMetric({ key: 'system:cpu:load', value: load, op: 'max' });

        }, 60000); // Every minute
    }

    static async increment(key: string, amount: number = 1) {
        telemetryBus.emitMetric({ key, value: amount });
    }

    static async set(key: string, value: number) {
        telemetryBus.emitMetric({ key, value, op: 'set' });
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
 
export const metricsService = new MetricsService();
