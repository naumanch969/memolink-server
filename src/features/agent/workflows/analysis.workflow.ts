import { Types } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { Entry } from '../../entry/entry.model';
import Goal from '../../goal/goal.model';
import { IAgentWorkflow } from '../agent.interfaces';
import { AgentTask, IAgentTaskDocument } from '../agent.model';
import { AgentTaskStatus, AgentTaskType, AgentWorkflowResult } from '../agent.types';

// Output Schema for Weekly Analysis
const WeeklyAnalysisOutputSchema = z.object({
    periodSummary: z.string().describe("A high-level summary of the week's achievements and challenges."),
    moodTrend: z.string().describe("Observations on how the user's mood fluctuated throughout the week."),
    keyAchievements: z.array(z.string()).describe("3-5 concrete things the user accomplished this week."),
    areasForImprovement: z.array(z.string()).describe("1-3 areas where the user might benefit from more focus next week."),
    patternDiscovery: z.string().describe("Any recurring patterns or triggers identified."),
    score: z.number().min(1).max(10).describe("A 'Weekly Alignment Score' (1-10) indicating how well the week's activities aligned with their goals."),
    nextWeekFocus: z.string().describe("A suggested primary focus for the upcoming week.")
});

export type WeeklyAnalysisOutput = z.infer<typeof WeeklyAnalysisOutputSchema>;

export class WeeklyAnalysisWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.WEEKLY_ANALYSIS;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId } = task;
        try {
            const result = await this.runWeeklyAnalysis(userId);
            return { status: 'completed', result };
        } catch (error: any) {
            logger.error(`Weekly Analysis failed for user ${userId}`, error);
            return { status: 'failed', error: error.message };
        }
    }

    private async runWeeklyAnalysis(userId: string | Types.ObjectId): Promise<WeeklyAnalysisOutput> {
        logger.info(`Running Weekly Analysis for user ${userId}`);

        // Idempotency: Check if analysis was already generated TODAY
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const existingTask = await AgentTask.findOne({
            userId,
            type: AgentTaskType.WEEKLY_ANALYSIS,
            status: AgentTaskStatus.COMPLETED,
            createdAt: { $gte: startOfDay }
        });

        if (existingTask && existingTask.outputData) {
            logger.info(`Returning cached weekly analysis for user ${userId}`);
            return existingTask.outputData as WeeklyAnalysisOutput;
        }

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // 1. Fetch Entries summary stats
        const entries = await Entry.find({
            userId,
            createdAt: { $gte: weekAgo }
        }).select('mood createdAt tags type content').sort({ createdAt: 1 });

        // 3. Fetch Active Goals
        const goals = await Goal.find({ userId, status: 'active' }).select('title description milestones deadline');

        // 3.5 Guard: If no data at all, return default content
        if (entries.length === 0) {
            return {
                periodSummary: "You haven't logged much this week yet. Start journaling daily to unlock your weekly perspective!",
                moodTrend: "Not enough data to determine a trend.",
                keyAchievements: ["Started using Memolink"],
                areasForImprovement: ["Consistency in daily logging"],
                patternDiscovery: "Once you log more entries, I'll be able to identify patterns between your mood, and goals.",
                score: 5,
                nextWeekFocus: "Daily Journaling"
            };
        }

        // 4. Prepare Context
        const reflectionsContext = entries.map(e => {
            return `[${e.createdAt.toISOString().split('T')[0]}] Mood: ${e.mood}/5 - Content: ${e.content?.substring(0, 100)}... - Tags: ${e.tags?.join(', ')}`;
        }).join('\n');

        const goalsContext = goals.map(g => `- ${g.title}: ${g.description}`).join('\n');

        const tagsFrequency: Record<string, number> = {};
        entries.forEach(e => {
            e.tags?.forEach(tag => {
                const tagStr = tag.toString();
                tagsFrequency[tagStr] = (tagsFrequency[tagStr] || 0) + 1;
            });
        });
        const topTags = Object.entries(tagsFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => `${tag} (${count}x)`)
            .join(', ');

        const prompt = `
    You are Memolink, an expert life coach and data analyst. 
    Perform a Weekly Analysis for the user based on their data from the past 7 days.
    
    Daily Reflections Narrative (Last 7 Days):
    ${reflectionsContext || "No detailed daily reflections found. Base your analysis on raw entries if available."}
    
    Active Goals:
    ${goalsContext || "No active goals listed. Encourage the user to define what they are working toward."}
    
    Top Tags & Frequency (Last 7 Days):
    ${topTags || "No specific tags recorded."}
    
    CRITICAL INSTRUCTIONS:
    - Speak directly to the user as "You".
    - Be insightful, identifying non-obvious links between their mood, activity (tags), and progress.
    - If data is sparse, provide a "minimal" baseline analysis that is still encouraging.
    - You MUST return a valid JSON object with ALL the keys defined in the schema. Do not omit any keys.

    Task:
    1. periodSummary: A 2-3 sentence overview of their week's narrative.
    2. moodTrend: Analyze how their mood changed and why (if detectable).
    3. keyAchievements: Highlight 3-5 specific wins, even small ones. (Array of strings)
    4. areasForImprovement: 1-3 concrete areas for growth. (Array of strings)
    5. patternDiscovery: Look for correlations (e.g., "Logging 'work' late at night correlates with lower mood").
    6. score: A number (1-10) reflecting how much their actions matched their goals.
    7. nextWeekFocus: A single, actionable priority for the next 7 days.
    
    IMPORTANT: You MUST use these exact keys in your JSON response. Do not wrap the result in any other object.
    
    Return ONLY JSON.
    `;

        const result = await LLMService.generateJSON(prompt, WeeklyAnalysisOutputSchema, {
            temperature: 0.2, // Lower temperature for more stable schema adherence
            workflow: 'weekly_analysis',
            userId,
        });

        return result;
    }
}

export const weeklyAnalysisWorkflow = new WeeklyAnalysisWorkflow();
