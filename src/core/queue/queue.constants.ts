// ─── QUEUE NAMES ─────────────────────────────────────────────────────────────

export const ENRICHMENT_QUEUE_NAME = 'enrichment-queue';
export const ENRICHMENT_QUEUE_HEALING = 'enrichment-healing';

export const AGENT_QUEUE_NAME = 'agent-tasks';

export const EMAIL_QUEUE_NAME = 'email-delivery';
export const EMAIL_DLQ_NAME = 'email-delivery-dlq';

// ─── JOB NAMES ───────────────────────────────────────────────────────────────

export const ENRICHMENT_JOB_ACTIVE = 'process-active';
export const ENRICHMENT_JOB_PASSIVE = 'process-passive';
export const ENRICHMENT_JOB_HEALING = 'process-healing';

// ─── JOB OPTIONS ─────────────────────────────────────────────────────────────

export const ENRICHMENT_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
};

export const ENRICHMENT_HEALING_JOB_OPTIONS = {
    attempts: 1, // Only 1 attempt for healing to prevent loops
    backoff: { type: 'fixed' as const, delay: 60000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
};

export const AGENT_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
};

export const EMAIL_JOB_OPTIONS = {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};

export const EMAIL_DLQ_JOB_OPTIONS = {
    removeOnComplete: false,
    removeOnFail: false,
};

// ─── WORKER CONFIG ────────────────────────────────────────────────────────────

export const ENRICHMENT_WORKER_CONFIG = {
    concurrency: 10,
    lockDuration: 300_000,  // 5m — increased to prevent lock errors during long LLM tasks
    lockRenewTime: 15_000,  // renew every 15s to prevent stale-lock eviction
    // limiter: { max: 20, duration: 60_000 }, // Throttling disabled for faster response
};

export const ENRICHMENT_HEALING_WORKER_CONFIG = {
    concurrency: 2, // Low concurrency for healing to prioritize real-time traffic
    lockDuration: 300_000,
};

export const AGENT_WORKER_CONFIG = {
    concurrency: 10,
    lockDuration: 300_000,  // 5 min — agent workflows can be long-running
};

export const EMAIL_WORKER_CONFIG = {
    concurrency: 10,
    limiter: { max: 10, duration: 1_000 },  // 10 emails/sec
};
