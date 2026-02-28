import { endOfWeek, startOfWeek } from 'date-fns';
import { Types } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { reportContextBuilder } from '../../report/report.context-builder';
import { ReportType } from '../../report/report.types';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';

// ─── Output Schema ────────────────────────────────────────────────────────────

const WeeklyAnalysisOutputSchema = z.object({
    // Narrative
    headline: z
        .string()
        .describe("One punchy sentence that names the week. E.g. 'A week of momentum interrupted by avoidance.'"),
    periodNarrative: z
        .string()
        .describe('3-4 sentences telling the story of the week honestly.'),

    // Scores
    alignmentScore: z
        .number().min(1).max(100)
        .describe('How well did this week\'s actions match the user\'s stated goals? 1-100.'),
    energyArc: z
        .enum(['ascending', 'descending', 'volatile', 'flat'])
        .describe('The overall energy trajectory of the week based on mood and entry data.'),

    // Mood intelligence
    moodInsight: z.object({
        dominantState: z.string().describe("The dominant emotional state, e.g. 'driven but anxious'."),
        peakDay: z.string().describe('ISO date of the best mood day this week.'),
        lowestDay: z.string().describe('ISO date of the lowest mood day this week.'),
        triggerPattern: z.string().describe("Observable trigger: 'Your mood drops when...'"),
        moodEntryCorrelation: z.string().describe("How logging frequency related to mood, e.g. 'Days with 3+ entries averaged mood 4.1 vs 2.8 on silent days'."),
    }),

    // Goal intelligence
    goalPulse: z.array(z.object({
        goalTitle: z.string(),
        periodLogs: z.number().describe('How many times this goal was logged this week.'),
        momentumSignal: z
            .enum(['accelerating', 'steady', 'decelerating', 'stalled'])
            .describe('Directional signal for this goal this week.'),
        oneLineReality: z.string().describe("Direct: '4/7 days logged — on track.' or '0 logs — goal is stalling.'"),
    })),

    // Pattern layer (the magic)
    patterns: z.array(z.object({
        observation: z.string().describe("An observable data point: 'You logged gym 4x — all before 8am.'"),
        implication: z.string().describe("What it means: 'Morning is your activation window. Protect it.'"),
        confidence: z.enum(['strong', 'emerging', 'tentative']),
    })).describe('1-3 patterns. Only include confident ones.'),

    // Relationship signal
    socialSignal: z
        .string().optional()
        .describe("People or entities that appeared notably this week, if any."),

    // Forward focus
    singleBestBet: z
        .string()
        .describe('The ONE highest-leverage thing to focus on next week. Be specific.'),
    specificMicroAction: z
        .string()
        .describe("A concrete, schedulable action: 'Block 7-8am Tuesday for X because Y.'"),

    // Raw stats for UI rendering
    stats: z.object({
        totalEntries: z.number(),
        totalWords: z.number(),
        avgMoodScore: z.number(),
        topTags: z.array(z.string()),
    }),
});

export type WeeklyAnalysisOutput = z.infer<typeof WeeklyAnalysisOutputSchema>;

// ─── Workflow ─────────────────────────────────────────────────────────────────

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

        const now = new Date();
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });

        const ctx = await reportContextBuilder.build(userId, start, end, ReportType.WEEKLY);

        if (ctx.totalEntries === 0) {
            return this.emptyWeekFallback(ctx);
        }

        const moodTimelineText = ctx.moodTimeSeries.length > 0
            ? ctx.moodTimeSeries.map(p => `${p.date}: ${p.score}/5${p.note ? ` (${p.note})` : ''}`).join('\n')
            : 'No dedicated mood logs this week. Use entry moodMetadata for approximation.';

        const goalContext = ctx.goalSnapshots.map(g =>
            `- ${g.title} | Streak: ${g.streakCurrent} days | This-week logs: ${g.periodLogs} | Milestones hit: ${g.milestonesHit}${g.why ? ` | Motivation: "${g.why}"` : ''}`
        ).join('\n') || 'No active goals.';

        const personaContext = ctx.personaMarkdown
            ? `USER PERSONA (who this person fundamentally is):\n${ctx.personaMarkdown.substring(0, 1500)}`
            : '';

        const entityContext = ctx.topEntities.length > 0
            ? `People/Places mentioned this week: ${ctx.topEntities.join(', ')}`
            : '';

        const webContext = ctx.webActivitySummary
            ? `Web Activity: ${ctx.webActivitySummary}`
            : '';

        const prompt = `
You are Memolink — a data-driven personal analyst and uncompromising coach. 
Perform a Weekly Analysis for the user.

${personaContext}

ENTRIES (Last 7 Days — ${ctx.totalEntries} total, ~${ctx.totalWords} words):
${ctx.entryNarrative || 'No entries this week.'}

DEDICATED MOOD SCORES (1-5 scale, from Mood tracker):
${moodTimelineText}

ACTIVE GOALS:
${goalContext}

TOP TAGS THIS WEEK: ${ctx.topTags.slice(0, 10).join(', ') || 'None'}

${entityContext}

${webContext}

CRITICAL INSTRUCTIONS:
- Speak directly to the user as "you".
- Be insightful. Detect non-obvious links between mood, tags, goal logs, and time of day.
- The "patterns" array should surface connections the user themselves might not have noticed.
- "goalPulse" must reference the actual periodLogs numbers — do not generalize.
- "moodInsight.peakDay" and "lowestDay" must be real dates from the mood data above.
- If persona data is present, use it to make your language and tone resonate with who this person is.
- Do NOT sugarcoat stagnation. Do NOT over-praise minimal effort.
- stats.totalEntries = ${ctx.totalEntries}, stats.totalWords = ${ctx.totalWords}, stats.avgMoodScore = ${ctx.avgMoodScore}

Return ONLY valid JSON matching the schema exactly. No markdown, no extra text.
`;

        return LLMService.generateJSON(prompt, WeeklyAnalysisOutputSchema, {
            temperature: 0.25,
            workflow: 'weekly_analysis',
            userId,
        });
    }

    private emptyWeekFallback(ctx: { goalSnapshots: any[]; topTags: string[] }): WeeklyAnalysisOutput {
        return {
            headline: "A silent week — the journal waits.",
            periodNarrative: "No entries were logged this week. Reflection is the first step toward growth; without it, patterns go undetected and progress stalls.",
            alignmentScore: 1,
            energyArc: 'flat',
            moodInsight: {
                dominantState: "Unknown — no data logged",
                peakDay: "",
                lowestDay: "",
                triggerPattern: "Cannot determine without entries.",
                moodEntryCorrelation: "Start logging daily to unlock this insight.",
            },
            goalPulse: ctx.goalSnapshots.map(g => ({
                goalTitle: g.title,
                periodLogs: 0,
                momentumSignal: 'stalled' as const,
                oneLineReality: "0 logs this week — goal is invisible without action.",
            })),
            patterns: [],
            socialSignal: undefined,
            singleBestBet: "Log one entry every day for 7 days straight.",
            specificMicroAction: "Set a daily 9pm reminder: write one sentence about your day.",
            stats: {
                totalEntries: 0,
                totalWords: 0,
                avgMoodScore: 0,
                topTags: ctx.topTags.slice(0, 5),
            },
        };
    }
}

export const weeklyAnalysisWorkflow = new WeeklyAnalysisWorkflow();
