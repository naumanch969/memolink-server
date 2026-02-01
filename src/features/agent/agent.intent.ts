
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
    CMD_REMINDER_UPDATE = 'CMD_REMINDER_UPDATE', // "Move that doc task to tomorrow", "Reschedule my meeting"
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
    date: z.string().optional().nullable().describe('Relative or absolute dates'),
    time: z.string().optional().nullable().describe('Time if specified'),
    title: z.string().optional().nullable().describe('Concise title'),
    priority: z.preprocess((val) => typeof val === 'string' ? val.toLowerCase() : val, z.enum(['low', 'medium', 'high']).optional().nullable()),
    person: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().describe('Any additional intent-specific metadata (e.g. why, reward, targetValue, unit, linkedRoutines for goals)'),
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
    reasoning?: string;
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
        1. CMD_GOAL_CREATE: 
           - **CRITICAL PRIORITY**: If the user explicitly mentions "Create a goal", "Goal Title", "Target Metrics", or provides a structured goal definition, it MUST be classified as CMD_GOAL_CREATE.
           - Even if the text contains long personal reflections or "Why" sections, if it's framed as a goal definition, it is NOT JOURNALING.

        2. CMD_REMINDER_CREATE: Explicit requests to be reminded/notified. (e.g. "Remind me...", "Don't let me forget")
        3. CMD_TASK_CREATE: Actionable to-dos that are short-term. (e.g. "Buy milk", "Add to list")
        4. CMD_REMINDER_UPDATE: Modifying existing tasks/reminders. (e.g. "Move that task to 5pm", "Reschedule the meeting to tomorrow", "Cancel that reminder")
        5. QUERY_KNOWLEDGE: Questions about past data/memories.
        6. JOURNALING: Recording past events, feelings, or reflections (e.g. "I ran today").
           - **NEGATIVE CONSTRAINT**: Do NOT use JOURNALING if the text looks like a goal setup.
        7. UNKNOWN: Gibberish.

        EXTRACTION RULES:
        - For CMD intents, extract standard fields: 'title', 'date', 'priority' (MUST be 'low', 'medium', or 'high').
        - For any other intent-specific details, extract them into the 'metadata' object.
        - For CMD_GOAL_CREATE, specifically extract into 'metadata':
            - 'why': The motivation part.
            - 'targetValue': Any numeric target mentioned.
            - 'unit': The unit for that number.
            - 'reward': Any reward mentioned.
            - 'description': Any additional psychological context or details.
            - 'linkedRoutines': Names of existing routines or habits mentioned (e.g. ['Sending proposals', '8 hours of work']).
        - For CMD_REMINDER_UPDATE, also extract 'title' of the task being referred to.
        - For JOURNALING, you can ignore entities or extract date if specified.
        - 'date' should be relative or absolute (e.g. "tomorrow", "next friday", "5pm").
        
        CRITICAL:
        - **PRIORITY**: Structured goal definitions (Title/Why/Target) always override JOURNALING.
        - If the user says "Create a goal", classify as CMD_GOAL_CREATE even if the rest of the text looks like a story.
        - If the user implies a future action without explicit time, default to CMD_TASK_CREATE or CMD_REMINDER_CREATE based on urgency.
        - If the user says "move", "reschedule", "change", "delay", "postpone", "cancel", or uses referential terms like "that", "the task", "it", it is ALWAYS CMD_REMINDER_UPDATE.
        - You MUST include the 'reasoning' field explaining your choice.
        - You MUST include 'extractedEntities' for CMD intents.
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
        if (!parsedDate && [AgentIntentType.CMD_REMINDER_CREATE, AgentIntentType.CMD_TASK_CREATE, AgentIntentType.CMD_REMINDER_UPDATE].includes(intent)) {
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
            missingInfos,
            reasoning: result.reasoning
        };
    }
}
export const agentIntent = new AgentIntentClassifier();
