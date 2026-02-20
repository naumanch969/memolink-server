import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { Entry } from '../../entry/entry.model';
import Goal from '../../goal/goal.model';
import { AgentTask } from '../agent.model';
import { AgentTaskStatus, AgentTaskType } from '../agent.types';

// Output Schema for Monthly Analysis
const MonthlyAnalysisOutputSchema = z.object({
    monthOverview: z.string().describe("A high-level synthesis of everything that happened this month."),
    topThemes: z.array(z.string()).describe("3-5 recurring themes, habits, or topics that dominated the month."),
    goalDeepDive: z.array(z.object({
        goalTitle: z.string(),
        progressReflection: z.string().describe("How much actual progress was made vs. the goal's intent."),
        alignmentScore: z.number().min(1).max(10)
    })).describe("A critical look at active goals."),
    moodPattern: z.string().describe("Correlation between mood and specific activities or times of the month."),
    hardTruths: z.array(z.string()).describe("3-5 blunt, non-sugarcoated observations about the user's behaviors, excuses, or stagnation points."),
    achievements: z.array(z.string()).describe("Significant wins this month."),
    missedOpportunities: z.array(z.string()).describe("Areas where the user could have acted but didn't, based on their own notes/intent."),
    score: z.number().min(1).max(10).describe("Overall month alignment score."),
    nextMonthStrategy: z.string().describe("A concrete, no-nonsense strategy for the upcoming month.")
});

export type MonthlyAnalysisOutput = z.infer<typeof MonthlyAnalysisOutputSchema>;

export async function runMonthlyAnalysis(userId: string): Promise<MonthlyAnalysisOutput> {
    logger.info(`Running Monthly Analysis for user ${userId}`);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Fetch Weekly Analyses from the last month
    const weeklyAnalyses = await AgentTask.find({
        userId,
        type: AgentTaskType.WEEKLY_ANALYSIS,
        status: AgentTaskStatus.COMPLETED,
        createdAt: { $gte: startOfMonth }
    }).sort({ createdAt: 1 }).select('outputData createdAt');

    // 2. Fetch Active Goals
    const goals = await Goal.find({ userId, status: 'active' }).select('title description milestones');

    // 3. Fetch all entries for the month (for raw sentiment and tag analysis)
    const entries = await Entry.find({
        userId,
        createdAt: { $gte: startOfMonth }
    }).select('content mood tags createdAt').lean();

    // 3.5 Guard
    if (entries.length === 0 && weeklyAnalyses.length === 0) {
        return {
            monthOverview: "Not enough data recorded this month to generate a meaningful analysis.",
            topThemes: ["Low engagement"],
            goalDeepDive: [],
            moodPattern: "Insufficient data.",
            hardTruths: ["You haven't been logging your journey. Growth is hard to track in the dark."],
            achievements: [],
            missedOpportunities: ["Building a consistent reflection habit."],
            score: 1,
            nextMonthStrategy: "Start with one entry a day. No excuses."
        };
    }

    // 4. Prepare Context
    const weeklyContext = weeklyAnalyses.map(t => {
        const d = t.outputData as any;
        return `Week of ${t.createdAt.toDateString()}: ${d.periodSummary}\nScore: ${d.score}/10\nKey Achievements: ${d.keyAchievements?.join(', ')}`;
    }).join('\n\n');

    const goalsContext = goals.map(g => `- ${g.title}: ${g.description}`).join('\n');

    // Aggregate tags
    const tagsFrequency: Record<string, number> = {};
    entries.forEach(e => {
        e.tags?.forEach(tag => {
            const tagStr = tag.toString();
            tagsFrequency[tagStr] = (tagsFrequency[tagStr] || 0) + 1;
        });
    });
    const topTags = Object.entries(tagsFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag, count]) => `${tag} (${count}x)`)
        .join(', ');

    const prompt = `
    You are Memolink, an uncompromising life coach and data-driven personal analyst. 
    Perform a Monthly Analysis for the user.
    
    CRITICAL INSTRUCTION: 
    Do NOT sugarcoat. If the user is being lazy, call it out. If they are making progress, acknowledge it but focus on the "next level". 
    The user wants "Hard Truths" and "Meaningful Insight".
    
    Weekly Summaries for this Month:
    ${weeklyContext || "No weekly analyses performed yet this month."}
    
    Active Goals:
    ${goalsContext || "No active goals defined."}
    
    Total Entries this Month: ${entries.length}
    Top Themes/Tags: ${topTags || "None recorded."}
    
    Task:
    1. monthOverview: A synthesis of the monthly narrative.
    2. topThemes: Recurring themes or habits identified.
    3. goalDeepDive: Evaluate progress on active goals. Be critical if intent doesn't match action.
    4. moodPattern: Identify what drives their mood up or down over this 30-day period.
    5. hardTruths: BLUNT observations. What are they avoiding? What excuses are visible in their notes? (Array of strings)
    6. achievements: Major wins.
    7. missedOpportunities: Where did they fail to follow through?
    8. score: 1-10 overall alignment score.
    9. nextMonthStrategy: A specific, no-nonsense priority list for next month.
    
    Return ONLY valid JSON matching the schema.
    `;

    const result = await LLMService.generateJSON(prompt, MonthlyAnalysisOutputSchema, {
        temperature: 0.3,
        workflow: 'monthly_analysis',
        userId,
    });

    return result;
}
