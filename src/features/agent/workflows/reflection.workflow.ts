import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { Entry } from '../../entry/entry.model';
import Goal from '../../goal/goal.model';
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
    moodScore: z.number().min(1).max(5).describe("A score from 1-5 representing the user's overall mood today based on their entries."),
    summary: z.string().describe("A concise summary of the day's events and thoughts, written in the second person ('You...')."),
    keyThemes: z.array(z.string()).describe("A list of 3-5 main themes or topics discussed today."),
    actionableInsights: z.array(z.string()).describe("1-3 constructive, specific suggestions based on the user's entries. If they set tasks for tomorrow, comment on their preparedness."),
    dominantEmotion: z.string().describe("The single most dominant emotion felt today."),
    motivationalQuote: z.string().describe("A short, relevant motivational quote to boost the user."),
    statsMessage: z.string().describe("A data-driven encouragement message linking today's progress to their yearly/long-term goals (e.g., 'You are statistically moving closer...')."),
});

export type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;

export async function runDailyReflection(userId: string, input: DailyReflectionInput): Promise<ReflectionOutput> {
    logger.info(`Running Daily Reflection for user ${userId}`);

    // 1. Determine Time Range
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

    // 2. Fetch Data (Entries and Goals)
    const [entries, goals] = await Promise.all([
        Entry.find(query).sort({ createdAt: 1 }).select('content mood createdAt tags type'),
        Goal.find({ userId, status: 'active' }).select('title description milestones deadline')
    ]);

    if (!entries || entries.length === 0) {
        return {
            moodScore: 3,
            summary: "You haven't logged any entries for this period yet. Take a moment to jot down your thoughts so we can track your journey!",
            keyThemes: ["No Data"],
            actionableInsights: ["Try writing a quick note about how you're feeling right now."],
            dominantEmotion: "Neutral",
            motivationalQuote: "The journey of a thousand miles begins with a single step.",
            statsMessage: "Ready to start? Define a goal to begin tracking your statistical progress.",
        };
    }

    // 3. Prepare Context for LLM
    const entriesContext = entries.map((e) => {
        return `[${e.createdAt.toISOString()}] (Mood: ${e.mood || 'N/A'}/5) (Tags: ${e.tags?.join(', ') || 'None'}): ${e.content}`;
    }).join('\n\n');

    const goalsContext = goals.map(g => `- ${g.title} (Due: ${g.deadline ? new Date(g.deadline).toLocaleDateString() : 'No deadline'})`).join('\n');

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
        return `[${t.createdAt.toISOString().split('T')[0]}] Mood: ${d.moodScore}/5 - ${d.summary}`;
    }).join('\n');

    const prompt = `
    Analyze the following journal entries from the user for today/recent period.
    Your goal is to act as a wise, empathetic, and insightful personal assistant / therapist.
    
    Context (Last 7 Days):
    ${historyContext || "No previous reflections available."}

    Active Goals:
    ${goalsContext || "No active goals found."}

    Today's Entries:
    ${entriesContext}
    
    Task:
    1. Estimate the overall mood score on a scale of 1-5 (1=Rough, 2=Difficult, 3=Neutral, 4=Good, 5=Great).
    2. Summarize the day's narrative in 2-3 sentences (speak to the user as "You").
    3. Identify key themes.
    4. Provide actionable insights. 
       - If the user has a "Plan for Tomorrow" section, evaluate if it's realistic and encourage them.
       - If not, suggest setting one small goal for tomorrow.
    5. Identify the dominant emotion.
    6. Select a unique, relevant motivational quote.
    7. Generate a "stats message" that explicitly connects the user's effort today to their yearly/active goals. Be encouraging. (e.g. "By handling X today, you are statistically moving closer to [Goal Name]...").

    Output strictly in JSON with the following keys:
    {
        "moodScore": number,
        "summary": "string",
        "keyThemes": ["string", "string"],
        "actionableInsights": ["string", "string"],
        "dominantEmotion": "string",
        "motivationalQuote": "string",
        "statsMessage": "string"
    }
    `;

    // 4. Call LLM
    const result = await LLMService.generateJSON(prompt, ReflectionOutputSchema, {
        temperature: 0.4, // Lower temperature for more consistent analysis
    });

    return result;
}
