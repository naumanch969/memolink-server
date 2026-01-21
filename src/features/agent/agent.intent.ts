

import * as chrono from 'chrono-node';
import { z } from 'zod';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/LLMService';
import { ChatMessage } from './agent.memory';
import fs from 'fs'
import path from 'path'

// 1. Define Intention Types
export enum AgentIntentType {
    JOURNALING = 'JOURNALING', // "Today was a good day..."
    CMD_TASK_CREATE = 'CMD_TASK_CREATE', // "Remind me to buy milk" (Generic Task)
    CMD_REMINDER_CREATE = 'CMD_REMINDER_CREATE', // "Set a reminder for 5pm"
    CMD_GOAL_CREATE = 'CMD_GOAL_CREATE', // "I want to lose 5kg by June"
    QUERY_KNOWLEDGE = 'QUERY_KNOWLEDGE', // "What did I do last week?"
    UNKNOWN = 'UNKNOWN'
}

// 2. Define Output Schema for the Classifier
const intentSchema = z.object({
    intent: z.nativeEnum(AgentIntentType).describe('The primary intent of the user input'),
    confidence: z.number().min(0).max(1).optional().describe('Confidence score between 0 and 1'),
    extractedEntities: z.object({
        date: z.string().optional().describe('Relative or absolute dates found (e.g. "tomorrow", "next friday")'),
        time: z.string().optional().describe('Time if specified (e.g. "5pm", "14:00")'),
        title: z.string().optional().describe('A concise title for the task/reminder/goal'),
        targetList: z.string().optional().describe('Target list/category if specified (e.g. "shopping list")'),
        person: z.string().optional().describe('Any person mentioned that is relevant to the command'),
        priority: z.enum(['low', 'medium', 'high']).optional().describe('Implied priority'),
        isRecurring: z.boolean().optional().describe('If the task implies repetition'),
    }).optional().describe('Key entities extracted for immediate use')
});

export interface IntentResult extends z.infer<typeof intentSchema> {
    parsedEntities: {
        date?: Date;
    };
}

export class AgentIntentClassifier {

    /**
     * Classify user natural language into an Intent + Entities
     * @param history Optional conversation history to resolve context
     */
    async classify(text: string, history: ChatMessage[] = []): Promise<IntentResult> {

        const historyText = history.length > 0
            ? history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
            : "No previous context.";

        const prompt = `
      You are an Intent Classifier for a personal life assistant AI.
      Analyze the following user text and categorize it into one of the allowed intents.

            Context(Recent Conversation):
        """
      ${historyText}
        """

        Categories & Examples:
        - JOURNALING:
        Criteria: Personal stories, diary entries, thoughts, feelings, "brain dumps".No specific action requested.
            Examples: "Today was a good day", "I felt anxious about the meeting", "Just thinking about life".
      
      - CMD_REMINDER_CREATE:
        Criteria: Explicit request for a reminder or notification at a specific time / date.
            Examples: "Remind me to call John at 5pm", "Wake me up at 7am", "Set a reminder for the dentist tomorrow".

      - CMD_TASK_CREATE:
        Criteria: Actionable to -do items, tasks, or errands without a strict notification time request.
            Examples: "Buy milk", "Fix the garage door", "Add 'Email boss' to my list", "I need to clean the house".

      - CMD_GOAL_CREATE:
        Criteria: Long - term ambitious objectives, habits, or targets.
            Examples: "I want to lose 5kg by June", "Read 12 books this year", "Learn Spanish".

      - QUERY_KNOWLEDGE:
        Criteria: Questions about past entries, stats, or seeking information from the system.
            Examples: "What did I do last week?", "How many times did I exercise?", "When was the last time I saw Sarah?".

      - UNKNOWN:
        Criteria: Text that is unintelligible or completely unrelated.

      User Text:
        """
      ${text}
        """

        INSTRUCTIONS:
        1. If the text starts with a verb like "Buy", "Call", "Fix", "Remind", it is likely a COMMAND.
      2. If the text describes feelings or past events("I went...", "It was..."), it is likely JOURNALING.
      3. Return JSON matching the schema.Extract a concise 'title' that captures the core action.
    `;

        try {
            const result = await LLMService.generateJSON(prompt, intentSchema);

            // Post-Processing: Parse Dates
            let parsedDate: Date | undefined;

            // 1. Try to parse the LLM extracted date string
            const entities = result.extractedEntities || {};
            if (entities.date) {
                parsedDate = chrono.parseDate(entities.date);
            }

            // 2. If LLM missed it, try parsing the whole text (fallback)
            // Only do this if we are in a context where a date is expected but missing,
            // or just always try to find a reference date if none was found.
            if (!parsedDate) {
                const parsedResults = chrono.parse(text);
                if (parsedResults.length > 0) {
                    parsedDate = parsedResults[0].start.date();
                }
            }

            return {
                ...result,
                parsedEntities: {
                    date: parsedDate
                }
            };

        } catch (error: unknown) {
            logger.error('Intent Classification Failed', error);
            try {
                fs.appendFileSync(path.resolve(__dirname, '../../../debug-intent.log'),
                    `[${new Date().toISOString()}] Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))} \n`
                );
            } catch {
                /* ignore */
            }

            // Fallback
            return {
                intent: AgentIntentType.JOURNALING, // Default safe fallback
                confidence: 0,
                extractedEntities: {},
                parsedEntities: {}
            };
        }
    }
}

export const agentIntent = new AgentIntentClassifier();
