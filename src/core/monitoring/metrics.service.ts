import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../../config/logger';

/**
 * Metrics Service - Centralized monitoring and metrics collection
 * Uses Prometheus client for industry-standard metrics
 */
class MetricsService {
    private registry: Registry;

    // HTTP Metrics
    public httpRequestDuration: Histogram;
    public httpRequestTotal: Counter;
    public httpRequestErrors: Counter;
    public httpRequestSize: Histogram;
    public httpResponseSize: Histogram;

    // Database Metrics
    public dbQueryDuration: Histogram;
    public dbQueryTotal: Counter;
    public dbQueryErrors: Counter;
    public dbConnectionsActive: Gauge;

    // Application Metrics
    public activeUsers: Gauge;
    public memoryUsage: Gauge;
    public cpuUsage: Gauge;
    public eventLoopLag: Gauge;

    // Business Metrics
    public entriesCreated: Counter;
    public goalsCreated: Counter;
    public tagsCreated: Counter;
    public mediaUploaded: Counter;

    // Cache Metrics
    public cacheHits: Counter;
    public cacheMisses: Counter;

    constructor() {
        this.registry = new Registry();

        // Collect default metrics (CPU, memory, etc.)
        collectDefaultMetrics({
            register: this.registry,
            prefix: 'memolink_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        });

        // Initialize HTTP Metrics
        this.httpRequestDuration = new Histogram({
            name: 'memolink_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
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

        this.httpRequestSize = new Histogram({
            name: 'memolink_http_request_size_bytes',
            help: 'Size of HTTP requests in bytes',
            labelNames: ['method', 'route'],
            buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
            registers: [this.registry],
        });

        this.httpResponseSize = new Histogram({
            name: 'memolink_http_response_size_bytes',
            help: 'Size of HTTP responses in bytes',
            labelNames: ['method', 'route'],
            buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
            registers: [this.registry],
        });

        // Initialize Database Metrics
        this.dbQueryDuration = new Histogram({
            name: 'memolink_db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'collection'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        this.dbQueryTotal = new Counter({
            name: 'memolink_db_queries_total',
            help: 'Total number of database queries',
            labelNames: ['operation', 'collection'],
            registers: [this.registry],
        });

        this.dbQueryErrors = new Counter({
            name: 'memolink_db_query_errors_total',
            help: 'Total number of database query errors',
            labelNames: ['operation', 'collection', 'error_type'],
            registers: [this.registry],
        });

        this.dbConnectionsActive = new Gauge({
            name: 'memolink_db_connections_active',
            help: 'Number of active database connections',
            registers: [this.registry],
        });

        // Initialize Application Metrics
        this.activeUsers = new Gauge({
            name: 'memolink_active_users',
            help: 'Number of currently active users',
            registers: [this.registry],
        });

        this.memoryUsage = new Gauge({
            name: 'memolink_memory_usage_bytes',
            help: 'Memory usage in bytes',
            labelNames: ['type'],
            registers: [this.registry],
        });

        this.cpuUsage = new Gauge({
            name: 'memolink_cpu_usage_percent',
            help: 'CPU usage percentage',
            registers: [this.registry],
        });

        this.eventLoopLag = new Gauge({
            name: 'memolink_event_loop_lag_seconds',
            help: 'Event loop lag in seconds',
            registers: [this.registry],
        });

        // Initialize Business Metrics
        this.entriesCreated = new Counter({
            name: 'memolink_entries_created_total',
            help: 'Total number of entries created',
            labelNames: ['user_id'],
            registers: [this.registry],
        });

        this.goalsCreated = new Counter({
            name: 'memolink_goals_created_total',
            help: 'Total number of goals created',
            labelNames: ['user_id', 'goal_type'],
            registers: [this.registry],
        });

        this.tagsCreated = new Counter({
            name: 'memolink_tags_created_total',
            help: 'Total number of tags created',
            labelNames: ['user_id'],
            registers: [this.registry],
        });

        this.mediaUploaded = new Counter({
            name: 'memolink_media_uploaded_total',
            help: 'Total number of media files uploaded',
            labelNames: ['user_id', 'media_type'],
            registers: [this.registry],
        });

        // Initialize Cache Metrics
        this.cacheHits = new Counter({
            name: 'memolink_cache_hits_total',
            help: 'Total number of cache hits',
            labelNames: ['cache_name'],
            registers: [this.registry],
        });

        this.cacheMisses = new Counter({
            name: 'memolink_cache_misses_total',
            help: 'Total number of cache misses',
            labelNames: ['cache_name'],
            registers: [this.registry],
        });

        // Start collecting system metrics
        this.startSystemMetricsCollection();

        logger.info('Metrics service initialized successfully');
    }

    /**
     * Get all metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    /**
     * Get metrics as JSON
     */
    async getMetricsJSON(): Promise<any> {
        const metrics = await this.registry.getMetricsAsJSON();
        return metrics;
    }

    /**
     * Get registry for custom metric registration
     */
    getRegistry(): Registry {
        return this.registry;
    }

    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(
        method: string,
        route: string,
        statusCode: number,
        duration: number,
        requestSize?: number,
        responseSize?: number
    ): void {
        this.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration
        );

        this.httpRequestTotal.inc({
            method,
            route,
            status_code: statusCode,
        });

        if (requestSize) {
            this.httpRequestSize.observe({ method, route }, requestSize);
        }

        if (responseSize) {
            this.httpResponseSize.observe({ method, route }, responseSize);
        }

        // Record errors (4xx and 5xx)
        if (statusCode >= 400) {
            const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
            this.httpRequestErrors.inc({ method, route, error_type: errorType });
        }
    }

    /**
     * Record database query metrics
     */
    recordDbQuery(
        operation: string,
        collection: string,
        duration: number,
        error?: Error
    ): void {
        this.dbQueryDuration.observe({ operation, collection }, duration);
        this.dbQueryTotal.inc({ operation, collection });

        if (error) {
            this.dbQueryErrors.inc({
                operation,
                collection,
                error_type: error.name || 'UnknownError',
            });
        }
    }

    /**
     * Update active database connections
     */
    updateDbConnections(count: number): void {
        this.dbConnectionsActive.set(count);
    }

    /**
     * Update active users count
     */
    updateActiveUsers(count: number): void {
        this.activeUsers.set(count);
    }

    /**
     * Record business metrics
     */
    recordEntryCreated(userId: string): void {
        this.entriesCreated.inc({ user_id: userId });
    }

    recordGoalCreated(userId: string, goalType: string): void {
        this.goalsCreated.inc({ user_id: userId, goal_type: goalType });
    }

    recordTagCreated(userId: string): void {
        this.tagsCreated.inc({ user_id: userId });
    }

    recordMediaUploaded(userId: string, mediaType: string): void {
        this.mediaUploaded.inc({ user_id: userId, media_type: mediaType });
    }

    /**
     * Record cache metrics
     */
    recordCacheHit(cacheName: string): void {
        this.cacheHits.inc({ cache_name: cacheName });
    }

    recordCacheMiss(cacheName: string): void {
        this.cacheMisses.inc({ cache_name: cacheName });
    }

    /**
     * Start collecting system metrics periodically
     */
    private startSystemMetricsCollection(): void {
        // Collect memory metrics every 10 seconds
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
            this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
            this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
            this.memoryUsage.set({ type: 'external' }, memUsage.external);
        }, 10000);

        // Collect CPU metrics every 10 seconds
        let lastCpuUsage = process.cpuUsage();
        setInterval(() => {
            const currentCpuUsage = process.cpuUsage(lastCpuUsage);
            const totalUsage = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
            this.cpuUsage.set(totalUsage);
            lastCpuUsage = process.cpuUsage();
        }, 10000);

        // Measure event loop lag
        let lastCheck = Date.now();
        setInterval(() => {
            const now = Date.now();
            const lag = (now - lastCheck - 1000) / 1000; // Expected 1 second, actual lag
            this.eventLoopLag.set(Math.max(0, lag));
            lastCheck = now;
        }, 1000);
    }

    /**
     * Reset all metrics (useful for testing)
     */
    reset(): void {
        this.registry.resetMetrics();
        logger.info('All metrics have been reset');
    }
}

// Export singleton instance
export const metricsService = new MetricsService();
