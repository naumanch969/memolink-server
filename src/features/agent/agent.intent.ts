

import * as chrono from 'chrono-node';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/LLMService';
import { ChatMessage } from './agent.memory';

// 1. Define Intention Types
export enum AgentIntentType {
    JOURNALING = 'JOURNALING', // "Today was a good day..."
    CMD_TASK_CREATE = 'CMD_TASK_CREATE', // "Remind me to buy milk" (Generic Task)
    CMD_REMINDER_CREATE = 'CMD_REMINDER_CREATE', // "Set a reminder for 5pm"
    CMD_GOAL_CREATE = 'CMD_GOAL_CREATE', // "I want to lose 5kg by June"
    QUERY_KNOWLEDGE = 'QUERY_KNOWLEDGE', // "What did I do last week?"
    UNKNOWN = 'UNKNOWN'
}

// 2. Define Output Schema for the Router (Strictly Classification)
const routerSchema = z.object({
    intent: z.nativeEnum(AgentIntentType).describe('The primary intent of the user input'),
    reasoning: z.string().describe('Brief reasoning for why this intent was chosen, distinguishing between past reflection (Journaling) and future requests (Commands)'),
    confidence: z.number().min(0).max(1).optional().describe('Confidence score'),
});

// 3. Define Extraction Schemas for Specialists
const entitySchema = z.object({
    date: z.string().optional().describe('Relative or absolute dates'),
    time: z.string().optional().describe('Time if specified'),
    title: z.string().optional().describe('Concise title'),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    person: z.string().optional(),
});

export interface IntentResult {
    intent: AgentIntentType;
    confidence?: number;
    extractedEntities?: z.infer<typeof entitySchema>;
    parsedEntities: {
        date?: Date;
    };
    needsClarification?: boolean;
    missingInfos?: string[];
}

export class AgentIntentClassifier {

    /**
     * Unified Classification & Extraction
     * Performs intent classification and entity extraction in a single pass to reduce latency.
     */
    async classify(text: string, history: ChatMessage[] = [], timezone?: string): Promise<IntentResult> {
        // 1. Prepare Context
        const historyText = history.slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        // 2. Define Output Schema
        const classificationSchema = routerSchema.extend({
            extractedEntities: entitySchema.optional().describe('Extracted entities if applicable for the intent')
        });

        // 3. Construct Prompt
        const prompt = `
        You are the Intent Classifier and Entity Extractor for MemoLink.
        Analyze the USER TEXT and determine the intent and extract relevant details.
        
        CONTEXT:
        ${historyText}
        
        USER TEXT: "${text}"
        
        INTENT RULES:
        1. CMD_REMINDER_CREATE: requests to be reminded/notified. (e.g. "Remind me...", "Don't let me forget")
        2. CMD_TASK_CREATE: actionable to-dos. (e.g. "Buy milk", "Add to list")
        3. CMD_GOAL_CREATE: long-term ambitions. (e.g. "Run a marathon")
        4. QUERY_KNOWLEDGE: questions about past data/memories.
        5. JOURNALING: recording past events/feelings (e.g. "I ran today").
        6. UNKNOWN: gibberish.

        EXTRACTION RULES:
        - For CMD intents, extract 'title', 'date', 'priority'.
        - For JOURNALING, you can ignore entities or extract date if specified.
        - 'date' should be relative or absolute (e.g. "tomorrow", "next friday", "5pm").
        
        CRITICAL:
        - If the user implies a future action without explicit time, default to CMD_TASK_CREATE or CMD_REMINDER_CREATE based on urgency.
        `;

        let result;
        try {
            result = await LLMService.generateJSON(prompt, classificationSchema);
        } catch (e) {
            logger.error("Classification Failed", e);
            return {
                intent: AgentIntentType.UNKNOWN,
                parsedEntities: { date: undefined }
            };
        }

        const { intent, extractedEntities = {}, confidence } = result;

        // 4. Post-Process (Date Parsing)
        let parsedDate: Date | undefined;
        let needsClarification = false;
        const missingInfos: string[] = [];

        // Parse date from extracted entity OR fallback to full text
        const dateText = extractedEntities?.date || (extractedEntities?.time ? `${extractedEntities.date || 'today'} ${extractedEntities.time}` : null);

        if (dateText) {
            parsedDate = chrono.parseDate(dateText, { timezone });
        }

        // Fallback: If no date extracted but chrono finds one in the text
        if (!parsedDate && [AgentIntentType.CMD_REMINDER_CREATE, AgentIntentType.CMD_TASK_CREATE].includes(intent)) {
            const parsedResults = chrono.parse(text, { timezone });
            if (parsedResults.length > 0) parsedDate = parsedResults[0].start.date();
        }

        // Validation Checks
        if (intent === AgentIntentType.CMD_REMINDER_CREATE && !parsedDate) {
            needsClarification = true;
            missingInfos.push('date/time');
        }

        return {
            intent,
            confidence: confidence || 1,
            extractedEntities,
            parsedEntities: { date: parsedDate },
            needsClarification,
            missingInfos
        };
    }
}
export const agentIntent = new AgentIntentClassifier();
