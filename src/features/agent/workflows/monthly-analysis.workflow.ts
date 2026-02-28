import { endOfMonth, startOfMonth } from 'date-fns';
import { Types } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { reportContextBuilder } from '../../report/report.context-builder';
import { ReportType } from '../../report/report.types';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';

// ─── Output Schema ────────────────────────────────────────────────────────────

const MonthlyAnalysisOutputSchema = z.object({
    // The Big Picture
    monthTitle: z
        .string()
        .describe("One memorable sentence naming the month. E.g. 'The Month You Rebuilt The Foundation.'"),
    executiveSummary: z
        .string()
        .describe('4-5 sentences. The month in full honesty — no sugarcoating.'),
    overallScore: z
        .number().min(1).max(100)
        .describe('Overall alignment score for the month. 1-100.'),

    // Longitudinal Mood Story
    moodStory: z.object({
        arc: z
            .enum(['growth', 'decline', 'recovery', 'plateau', 'turbulent'])
            .describe('The emotional arc across the 30-day period.'),
        bestWeek: z.string().describe('Date label for the highest-energy week (e.g. "Feb 10–16").'),
        hardestWeek: z.string().describe('Date label for the most difficult week.'),
        dominantEmotionalTheme: z
            .string()
            .describe("The emotional theme that ran through the whole month, e.g. 'Strategic anxiety.'"),
        sustainedPattern: z
            .string()
            .describe('A pattern only visible at 30-day view that would be invisible week-to-week.'),
    }),

    // Goal Reckoning (deep, quantified)
    goalReckoning: z.array(z.object({
        goalTitle: z.string(),
        periodLogs: z.number().describe('Total logs during this month.'),
        streakHighWater: z.number().describe('Longest streak achieved.'),
        streakCurrentEnd: z.number().describe('Streak at end of month.'),
        milestonesHit: z.number(),
        verdict: z.enum(['thriving', 'coasting', 'struggling', 'abandoned']),
        hardTruth: z.string().describe('One blunt, specific, data-backed sentence about this goal.'),
        nextMonthTarget: z.string().describe('A concrete, measurable target for next month.'),
    })),

    // Behavioral Fingerprint (persona-aware)
    behavioralInsights: z.array(z.object({
        pattern: z.string().describe('The observable behavior pattern from the data.'),
        root: z.string().describe('Possible psychological or situational root cause.'),
        leverage: z.string().describe('How to flip this pattern into an advantage next month.'),
    })).describe('2-4 behavioral insights. Only include if evidence is strong.'),

    // Hard Truths (max 4, unfiltered)
    hardTruths: z.array(z.string())
        .max(4)
        .describe('Blunt, uncomfortable, data-backed truths. Not mean — just honest.'),

    // Documented Wins
    documentedWins: z.array(z.object({
        win: z.string(),
        evidence: z.string().describe("Concrete backing: 'You logged gym 18/30 days — a personal best.'"),
    })).describe('Only include wins that have verifiable data backing.'),

    // Month-over-month comparison
    comparedToLastMonth: z.object({
        scoreChange: z.number().describe('Change in overall score vs previous month. Positive = improvement.'),
        narrative: z.string().describe("E.g. 'Up 12 points — strongest month in 3.'"),
        breakoutArea: z.string().optional().describe('The area that improved most vs last month.'),
        regressionArea: z.string().optional().describe('The area that declined most vs last month.'),
    }).optional().describe('Omit if no previous month report exists.'),

    // Forward Contract
    nextMonthContract: z.object({
        themeSentence: z.string().describe("E.g. 'March is about depth, not volume.'"),
        topThreePriorities: z.array(z.string()).length(3),
        oneThingToStop: z.string(),
        oneThingToStart: z.string(),
        successDefinition: z.string().describe("'You'll know March worked if...'"),
    }),

    // Raw stats for UI
    stats: z.object({
        totalEntries: z.number(),
        totalWords: z.number(),
        avgDailyMood: z.number(),
        moodDataDays: z.number(),
        goalsActive: z.number(),
        milestonesCompleted: z.number(),
        topTags: z.array(z.string()),
        topEntities: z.array(z.string()),
    }),
});

export type MonthlyAnalysisOutput = z.infer<typeof MonthlyAnalysisOutputSchema>;

// ─── Workflow ─────────────────────────────────────────────────────────────────

export class MonthlyAnalysisWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.MONTHLY_ANALYSIS;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId } = task;
        try {
            const result = await this.runMonthlyAnalysis(userId);
            return { status: 'completed', result };
        } catch (error: any) {
            logger.error(`Monthly Analysis failed for user ${userId}`, error);
            return { status: 'failed', error: error.message };
        }
    }

    private async runMonthlyAnalysis(userId: string | Types.ObjectId): Promise<MonthlyAnalysisOutput> {
        logger.info(`Running Monthly Analysis for user ${userId}`);

        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);

        const ctx = await reportContextBuilder.build(userId, start, end, ReportType.MONTHLY);

        if (ctx.totalEntries === 0 && ctx.goalSnapshots.length === 0) {
            return this.emptyMonthFallback();
        }

        const moodTimelineText = ctx.moodTimeSeries.length > 0
            ? ctx.moodTimeSeries.map(p => `${p.date}: ${p.score}/5`).join(', ')
            : 'No dedicated mood records. Use entry moodMetadata for approximation.';

        const goalContext = ctx.goalSnapshots.map(g => [
            `Goal: ${g.title}`,
            `  Logs this month: ${g.periodLogs}`,
            `  Current streak: ${g.streakCurrent} | Longest streak: ${g.streakLongest}`,
            `  Milestones hit this month: ${g.milestonesHit}`,
            g.why ? `  Motivation: "${g.why}"` : '',
            g.deadline ? `  Deadline: ${new Date(g.deadline).toISOString().split('T')[0]}` : '',
        ].filter(Boolean).join('\n')).join('\n\n') || 'No active goals.';

        const personaContext = ctx.personaMarkdown
            ? `USER PERSONA (identity document — who this person fundamentally is):\n${ctx.personaMarkdown.substring(0, 2000)}`
            : '';

        const previousContext = ctx.previousReport
            ? `PREVIOUS MONTH REPORT (for comparison):\nScore: ${ctx.previousReport.overallScore ?? ctx.previousReport.score ?? 'N/A'}/100\nSummary: ${ctx.previousReport.executiveSummary ?? ctx.previousReport.monthOverview ?? 'No summary'}`
            : '';

        const entityContext = ctx.topEntities.length > 0
            ? `People/Places most mentioned this month: ${ctx.topEntities.join(', ')}`
            : '';

        const webContext = ctx.webActivitySummary
            ? `Web Activity Summary: ${ctx.webActivitySummary}`
            : '';

        const totalMilestonesCompleted = ctx.goalSnapshots.reduce((s, g) => s + g.milestonesHit, 0);

        const prompt = `
You are Memolink — an uncompromising life coach and data-driven personal analyst.
Perform the Monthly Analysis for the user. This is the most important report they receive.

${personaContext}

ENTRIES THIS MONTH: ${ctx.totalEntries} total | ~${ctx.totalWords} words written

ENTRY NARRATIVE (chronological, last 30 days):
${ctx.entryNarrative || 'No entries recorded.'}

MOOD TIME-SERIES (dedicated tracker, 1-5 scale):
${moodTimelineText}

ACTIVE GOALS (with quantified progress):
${goalContext}

TOP TAGS THIS MONTH: ${ctx.topTags.slice(0, 15).join(', ') || 'None'}

${entityContext}

${webContext}

${previousContext}

CRITICAL INSTRUCTIONS:
- monthTitle: Make it memorable. It should name the month in a way that sticks.
- moodStory.sustainedPattern: This must be something only detectable at 30 days, NOT visible in a single week.
- goalReckoning: Reference actual numbers (periodLogs, streakCurrent, milestonesHit). No vague language.
- behavioralInsights: Root cause + leverage. This is the persona-aware layer. Use persona context to make it resonate.
- hardTruths: Max 4. These must reference observable data, not moral judgements.
- documentedWins: Only include wins with hard numbers. No participation awards.
- comparedToLastMonth: ${ctx.previousReport ? 'REQUIRED — a previous month report exists above.' : 'OMIT — no previous report available.'}
- nextMonthContract: Make it a real contract. Specific numbers and actions, not platitudes.
- Do NOT sugarcoat stagnation, excuses, or low-effort weeks.
- If the user is genuinely thriving, acknowledge it — but raise the bar.

STATS FOR RENDERING (use exactly): 
totalEntries=${ctx.totalEntries}, totalWords=${ctx.totalWords}, avgDailyMood=${ctx.avgMoodScore}, 
moodDataDays=${ctx.moodTimeSeries.length}, goalsActive=${ctx.goalSnapshots.length}, 
milestonesCompleted=${totalMilestonesCompleted}

Return ONLY valid JSON matching the schema exactly. No markdown, no extra text.
`;

        return LLMService.generateJSON(prompt, MonthlyAnalysisOutputSchema, {
            temperature: 0.3,
            workflow: 'monthly_analysis',
            userId,
        });
    }

    private emptyMonthFallback(): MonthlyAnalysisOutput {
        return {
            monthTitle: "The Month That Left No Trace.",
            executiveSummary: "No entries, no goal logs, no mood data. A month lived entirely off the record. Growth cannot be tracked — or accelerated — in the dark. This month is a baseline. The only direction is up.",
            overallScore: 1,
            moodStory: {
                arc: 'plateau',
                bestWeek: 'Unknown',
                hardestWeek: 'Unknown',
                dominantEmotionalTheme: 'Invisible — no data logged.',
                sustainedPattern: 'The only sustained pattern is silence. Start logging.',
            },
            goalReckoning: [],
            behavioralInsights: [{
                pattern: 'Consistent non-logging.',
                root: 'Possibly friction in the capture habit or low perceived value of journaling.',
                leverage: 'Start with voice entries — 30 seconds at day-end. Lower the bar until the habit is automatic.',
            }],
            hardTruths: [
                "You cannot improve what you don't measure. This month was unmeasured.",
                "Reflection is not optional for someone serious about growth.",
            ],
            documentedWins: [],
            nextMonthContract: {
                themeSentence: "Next month is about one thing: showing up.",
                topThreePriorities: ['Daily entry consistency', 'Activate at least one goal', 'Log mood every evening'],
                oneThingToStop: 'Letting days pass unrecorded.',
                oneThingToStart: 'A 9pm daily reflection ritual — even one sentence.',
                successDefinition: "You'll know next month worked if you have at least 20 entries and 14 mood logs.",
            },
            stats: {
                totalEntries: 0,
                totalWords: 0,
                avgDailyMood: 0,
                moodDataDays: 0,
                goalsActive: 0,
                milestonesCompleted: 0,
                topTags: [],
                topEntities: [],
            },
        };
    }
}

export const monthlyAnalysisWorkflow = new MonthlyAnalysisWorkflow();
