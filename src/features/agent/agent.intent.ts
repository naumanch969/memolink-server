
import * as chrono from 'chrono-node';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { ChatMessage } from './agent.memory';

// 1. Define Intention Types
export enum AgentIntentType {
    JOURNALING = 'JOURNALING', // "Today was a good day..."
    CMD_TASK_CREATE = 'CMD_TASK_CREATE', // "Remind me to buy milk" (Generic Task)
    CMD_REMINDER_CREATE = 'CMD_REMINDER_CREATE', // "Set a reminder for 5pm"
    CMD_GOAL_CREATE = 'CMD_GOAL_CREATE', // "I want to lose 5kg by June"
    CMD_REMINDER_UPDATE = 'CMD_REMINDER_UPDATE', // "Move that doc task to tomorrow", "Reschedule my meeting"
    QUERY_KNOWLEDGE = 'QUERY_KNOWLEDGE', // "What did I do last week?"
    UNKNOWN = 'UNKNOWN'
}

// 2. Define Extraction Schemas for Specialists
const entitySchema = z.object({
    date: z.string().optional().nullable().describe('Relative or absolute dates'),
    time: z.string().optional().nullable().describe('Time if specified'),
    title: z.string().optional().nullable().describe('Concise title'),
    priority: z.preprocess((val) => typeof val === 'string' ? val.toLowerCase() : val, z.enum(['low', 'medium', 'high']).optional().nullable()),
    person: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().describe('Any additional intent-specific metadata (e.g. why, reward, targetValue, unit, linkedRoutines for goals)'),
});

// 3. Define Output Schema for the Router
const intentionDetailSchema = z.object({
    intent: z.nativeEnum(AgentIntentType).describe('A specific intent detected in the text'),
    reasoning: z.string().describe('Brief reasoning for choosing this intent'),
    confidence: z.number().min(0).max(1).optional(),
    extractedEntities: entitySchema.optional().describe('Details relevant specifically to this intent')
});

const routerSchema = z.object({
    intents: z.array(intentionDetailSchema).min(1).describe('List of intents detected in the input text'),
    bestSummary: z.string().describe('A single cohesive summary of all detected actions/intents')
});

export interface Intention {
    intent: AgentIntentType;
    confidence?: number;
    extractedEntities?: z.infer<typeof entitySchema>;
    parsedEntities: {
        date?: Date;
    };
    needsClarification?: boolean;
    missingInfos?: string[];
    reasoning?: string;
}

export interface IntentResult {
    intents: Intention[];
    summary: string;
}

export class AgentIntentClassifier {

    /**
     * Unified Classification & Extraction
     * Performs intent classification and entity extraction in a single pass to reduce latency.
     */
    async classify(text: string, history: ChatMessage[] = [], timezone?: string): Promise<IntentResult> {
        // 1. Prepare Context
        const historyText = history.slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        // 2. Construct Prompt
        const prompt = `
        You are the Intent Classifier and Entity Extractor for MemoLink.
        Analyze the USER TEXT and detect ALL intents present. A single message can have MULTIPLE intents.
        
        Example: "I had a great day at the office but remind me to call Bob tomorrow at 10am."
        Intents: [JOURNALING, CMD_REMINDER_CREATE]
        
        USER TEXT: "${text}"
        RECENT CONTEXT:
        ${historyText}
        
        INTENT RULES:
        1. CMD_GOAL_CREATE: Formal goal setup (Title, Metric, Reward).
        2. CMD_REMINDER_CREATE: Explicit requests to be notified later.
        3. CMD_TASK_CREATE: Simple to-dos.
        4. CMD_REMINDER_UPDATE: Modifying/canceling existing tasks.
        5. QUERY_KNOWLEDGE: Questions about the past.
        6. JOURNALING: Recording events, feelings, daily wrap-ups.
        
        EXTRACTION RULES:
        - For CMD intents, extract: 'title', 'date', 'priority'.
        - For goals, extract: 'why', 'targetValue', 'unit', 'reward', 'linkedRoutines' into 'metadata'.
        - 'date' should be relative (e.g. "tomorrow", "5pm").
        `;

        let result;
        try {
            result = await LLMService.generateJSON(prompt, routerSchema);
        } catch (e) {
            logger.error("Multi-Intent Classification Failed", e);
            return {
                intents: [{
                    intent: AgentIntentType.UNKNOWN,
                    parsedEntities: { date: undefined }
                }],
                summary: "Error in classification"
            };
        }

        const processedIntents: Intention[] = result.intents.map(int => {
            let parsedDate: Date | undefined;
            let needsClarification = false;
            const missingInfos: string[] = [];

            const dateText = int.extractedEntities?.date || (int.extractedEntities?.time ? `${int.extractedEntities.date || 'today'} ${int.extractedEntities.time}` : null);
            if (dateText) {
                parsedDate = chrono.parseDate(dateText, { timezone });
            }

            if (!parsedDate && [AgentIntentType.CMD_REMINDER_CREATE, AgentIntentType.CMD_TASK_CREATE, AgentIntentType.CMD_REMINDER_UPDATE].includes(int.intent)) {
                const parsedResults = chrono.parse(text, { timezone });
                if (parsedResults.length > 0) parsedDate = parsedResults[0].start.date();
            }

            if (int.intent === AgentIntentType.CMD_REMINDER_CREATE && !parsedDate) {
                needsClarification = true;
                missingInfos.push('date/time');
            }

            return {
                intent: int.intent,
                confidence: int.confidence || 1,
                extractedEntities: int.extractedEntities,
                parsedEntities: { date: parsedDate },
                needsClarification,
                missingInfos,
                reasoning: int.reasoning
            };
        });

        return {
            intents: processedIntents,
            summary: result.bestSummary
        };
    }
}
export const agentIntent = new AgentIntentClassifier();
