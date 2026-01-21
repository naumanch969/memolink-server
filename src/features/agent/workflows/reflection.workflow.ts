import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { Entry } from '../../entry/entry.model';
import { AgentTask } from '../agent.model';
import { AgentTaskType } from '../agent.types';

// Input Validation Schema
export const DailyReflectionInputSchema = z.object({
    date: z.string().optional(), // ISO Date string, defaults to today
    timezone: z.string().optional(), // To handle "end of day" correctly
});

export type DailyReflectionInput = z.infer<typeof DailyReflectionInputSchema>;

// Output Schema (What the LLM will generate)
const ReflectionOutputSchema = z.object({
    moodScore: z.number().min(1).max(10).describe("A score from 1-10 representing the user's overall mood today based on their entries."),
    summary: z.string().describe("A concise summary of the day's events and thoughts, written in the second person ('You...')."),
    keyThemes: z.array(z.string()).describe("A list of 3-5 main themes or topics discussed today."),
    actionableInsights: z.array(z.string()).describe("1-3 constructive, specific suggestions based on the user's entries. Be gentle but helpful."),
    dominantEmotion: z.string().describe("The single most dominant emotion felt today."),
});

export type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;

export async function runDailyReflection(userId: string, input: DailyReflectionInput): Promise<ReflectionOutput> {
    logger.info(`Running Daily Reflection for user ${userId}`);

    // 1. Determine Time Range
    // Normalize to start and end of day in UTC (Simplification: dealing with timezones properly is complex, 
    // for MVP we assume the input date is "representative" and take +/- 12 hours or just the calendar day if timezone provided)
    // PROVISIONAL: Just get entries created in the last 24 hours from "now" if no date provided, or the specific calendar day.

    const query: Record<string, unknown> = { userId };

    if (input.date) {
        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else {
        // Default: Last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        query.createdAt = { $gte: yesterday };
    }

    // 2. Fetch Entries
    const entries = await Entry.find(query).sort({ createdAt: 1 }).select('content mood createdAt tags type');

    if (!entries || entries.length === 0) {
        return {
            moodScore: 5,
            summary: "You haven't logged any entries for this period yet. Take a moment to jot down your thoughts!",
            keyThemes: ["No Data"],
            actionableInsights: ["Try writing a quick note about how you're feeling right now."],
            dominantEmotion: "Neutral",
        };
    }

    // 3. Prepare Context for LLM
    const entriesContext = entries.map((e) => {
        return `[${e.createdAt.toISOString()}] (Mood: ${e.mood || 'N/A'}) (Tags: ${e.tags?.join(', ') || 'None'}): ${e.content}`;
    }).join('\n\n');

    // 2.5 Fetch Past Reflections (Longitudinal Context)
    const pastTasks = await AgentTask.find({
        userId,
        type: AgentTaskType.DAILY_REFLECTION,
        status: 'completed',
        createdAt: { $lt: new Date() } // exclude current one if any
    })
        .sort({ createdAt: -1 })
        .limit(7)
        .select('outputData createdAt');

    const historyContext = pastTasks.map(t => {
        const d = t.outputData as ReflectionOutput;
        return `[${t.createdAt.toISOString().split('T')[0]}] Mood: ${d.moodScore}/10 - ${d.summary}`;
    }).join('\n');

    const prompt = `
    Analyze the following journal entries from the user for today/recent period.
    Your goal is to act as a wise, empathetic, and insightful personal assistant / therapist.
    
    Context (Last 7 Days):
    ${historyContext || "No previous reflections available."}

    Today's Entries:
    ${entriesContext}
    
    Task:
    1. Estimate the overall mood score (1-10).
    2. Summarize the day's narrative in 2-3 sentences (speak to the user as "You").
    3. Identify key themes.
    4. Provide actionable insights. Connect today's events to the last 7 days of history if relevant (e.g., "You've been feeling down for 3 days...").
    5. Identify the dominant emotion.
    
    Output strictly in JSON with the following keys:
    {
        "moodScore": number,
        "summary": "string",
        "keyThemes": ["string", "string"],
        "actionableInsights": ["string", "string"],
        "dominantEmotion": "string"
    }
    `;

    // 4. Call LLM
    const result = await LLMService.generateJSON(prompt, ReflectionOutputSchema, {
        temperature: 0.4, // Lower temperature for more consistent analysis
    });

    return result;
}
