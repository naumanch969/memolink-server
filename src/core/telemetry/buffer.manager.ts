import { logger } from '../../config/logger';
import { SystemMetric } from '../../features/monitoring/metric.model';
import { calculateAICost } from './pricing.config';
import { AIUsagePayload, DBUsagePayload, HTTPUsagePayload, MetricPayload, TelemetryEvent, telemetryBus } from './telemetry.bus';

class BufferManager {
    private counters: Map<string, number> = new Map();
    private maxGauges: Map<string, number> = new Map();
    private setGauges: Map<string, number> = new Map();
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly FLUSH_PERIOD_MS = 60000; // 1 minute
    private readonly MAX_BUFFER_SIZE = 5000;

    constructor() {
        this.init();
    }

    private init() {
        // Listen to events 
        telemetryBus.on(TelemetryEvent.AI_REQUEST_COMPLETED, (p: AIUsagePayload) => {
            this.record(p.model, p.promptTokens, 'sum', `ai:tokens:prompt:${p.model}`);
            this.record(p.model, p.completionTokens, 'sum', `ai:tokens:completion:${p.model}`);
            this.record(p.model, 1, 'sum', `ai:requests:${p.model}`);
            if (p.feature) this.record(p.feature, 1, 'sum', `feature:${p.feature}:calls`);

            if (p.promptTokens !== undefined && p.completionTokens !== undefined) {
                const cost = calculateAICost(p.model, p.promptTokens, p.completionTokens);
                if (cost > 0) {
                    this.record('ai:cost:usd', cost, 'sum');
                    if (p.feature) this.record(`feature:${p.feature}:cost:usd`, cost, 'sum');
                }
            }
        });

        telemetryBus.on(TelemetryEvent.HTTP_REQUEST_COMPLETED, (p: HTTPUsagePayload) => {
            this.record(`http:status:${p.statusCode}`, 1, 'sum');
            // Track errors
            if (p.statusCode >= 400) {
                this.record('http:errors', 1, 'sum');
            }
            // Track latency
            if (p.duration) {
                this.record('http:latency:sum', p.duration, 'sum');
                this.record('http:requests:total', 1, 'sum');
            }
            if (p.egressBytes) this.record(`http:egress:bytes`, p.egressBytes, 'sum');
        });

        telemetryBus.on(TelemetryEvent.DB_QUERY_COMPLETED, (p: DBUsagePayload) => {
            this.record(`db:queries:${p.collection}`, 1, 'sum');
            this.record(`db:queries:total`, 1, 'sum');
        });

        telemetryBus.on(TelemetryEvent.SYSTEM_METRIC_UPDATE, (p: MetricPayload) => {
            if (p.op === 'max') {
                this.record(p.key, p.value, 'max');
            } else if (p.op === 'set') {
                this.record(p.key, p.value, 'set');
            } else {
                this.record(p.key, p.value, 'sum');
            }
        });

        this.startFlusher();
        logger.info('Telemetry BufferManager initialized (Flush interval: 60s)');
    }

    // Generic recorder
    private record(key: string, value: number, op: 'sum' | 'max' | 'set' = 'sum', specificKey?: string) {
        const finalKey = specificKey || key;

        if (op === 'max') {
            const current = this.maxGauges.get(finalKey) || -Infinity;
            if (value > current) {
                this.maxGauges.set(finalKey, value);
            }
        } else if (op === 'set') {
            this.setGauges.set(finalKey, value);
        } else {
            // Default sum
            const current = this.counters.get(finalKey) || 0;
            this.counters.set(finalKey, current + value);
        }

        if (this.counters.size + this.maxGauges.size + this.setGauges.size >= this.MAX_BUFFER_SIZE) {
            this.flush();
        }
    }

    // Kept for backward compat if needed but internal usage is now record()
    private increment(key: string, amount: number) {
        this.record(key, amount, 'sum');
    }

    public startFlusher() {
        if (this.flushInterval) return;
        this.flushInterval = setInterval(() => this.flush(), this.FLUSH_PERIOD_MS);
    }

    private getPeriodKey(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        return `${year}-${month}-${day}:${hour}`;
    }

    public async flush() {
        if (this.counters.size === 0 && this.maxGauges.size === 0 && this.setGauges.size === 0) return;

        const sumSnapshots = Array.from(this.counters.entries());
        const maxSnapshots = Array.from(this.maxGauges.entries());
        const setSnapshots = Array.from(this.setGauges.entries());

        this.counters.clear();
        this.maxGauges.clear();
        this.setGauges.clear();

        const period = this.getPeriodKey();
        const operations = [];

        // Sum updates use $inc
        sumSnapshots.forEach(([key, value]) => {
            operations.push({
                updateOne: {
                    filter: { key, period },
                    update: {
                        $inc: { value },
                        $set: {
                            lastUpdatedAt: new Date(),
                            'metadata.op': 'sum'
                        }
                    },
                    upsert: true
                }
            });
        });

        // Max updates use $max
        maxSnapshots.forEach(([key, value]) => {
            operations.push({
                updateOne: {
                    filter: { key, period },
                    update: {
                        $max: { value },
                        $set: {
                            lastUpdatedAt: new Date(),
                            'metadata.op': 'max'
                        }
                    },
                    upsert: true
                }
            });
        });

        // Set updates use $set
        setSnapshots.forEach(([key, value]) => {
            operations.push({
                updateOne: {
                    filter: { key, period },
                    update: {
                        $set: {
                            value,
                            lastUpdatedAt: new Date(),
                            'metadata.op': 'set'
                        }
                    },
                    upsert: true
                }
            });
        });

        try {
            if (operations.length > 0) {
                await SystemMetric.bulkWrite(operations);
                logger.debug(`[Telemetry] Flushed ${operations.length} buckets for period ${period}`);
            }
        } catch (error) {
            logger.error('[Telemetry] Failed to flush metrics', error);
        }
    }
    public getPendingMetrics() {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.maxGauges)
        };
    }
}

export const bufferManager = new BufferManager();
