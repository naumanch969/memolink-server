export const REPORT_CONSTANTS = {
    // Timing
    CRON_LOOKBACK_HOURS: 4, // Lookback applied so the cron period resolves to the just-completed week/month

    // Staggered cron batching
    CRON_BATCH_SIZE: 20,
    CRON_BATCH_DELAY_MS: 5000,

    // Limits
    TOP_TAGS_COUNT: 15,
    TOP_ENTITIES_COUNT: 10,
    TOP_DOMAINS_COUNT: 8,
    CONTEXT_SNIPPET_PADDING: 40,

    // Pagination
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,

    // Narrative
    MAX_ENTRY_NARRATIVE_LENGTH: 10000, // Safety cap for context window

    // Thresholds for report generation
    THRESHOLDS: {
        WEEKLY: {
            MIN_ENTRIES: 3,
            MIN_WORDS: 200,
            MIN_DAYS: 3
        },
        MONTHLY: {
            MIN_ENTRIES: 10,
            MIN_WORDS: 800,
            MIN_DAYS: 7
        }
    }
};
