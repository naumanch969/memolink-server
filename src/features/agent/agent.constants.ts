/**
 * Agent Feature Constants
 */

export const AGENT_CONSTANTS = {
    // Memory
    MEMORY_TTL: 60 * 60 * 24, // 24 hours
    MAX_HISTORY: 500,        // Items to keep in Redis

    // Chat Context
    MAX_CONTEXT_MESSAGES: 100, // Messages to send to LLM
    MAX_RE_ACT_ITERATIONS: 10,

    // Long-term Memory Flush
    FLUSH_THRESHOLD: 150,      // Trigger flush when history reaches this
    FLUSH_COUNT: 50,           // Number of messages to flush

    // Consolidation (Recursive Narrative)
    CONSOLIDATION_THRESHOLD: 3000, // Chars in rawMarkdown before crunching

    // Semantic Context
    ENTITY_NOTES_SLICE: 1500,  // Max chars for entity notes in prompt
};
