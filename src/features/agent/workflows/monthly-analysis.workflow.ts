import { endOfMonth, startOfMonth } from 'date-fns';
import { Types } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../config/logger';
import { llmService } from '../../../core/llm/llm.service';
import { reportContextBuilder } from '../../report/report.context-builder';
import { MoodArc, ReportType } from '../../report/report.types';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow, ProgressCallback, WorkflowStatus } from '../agent.types';

// ─── Output Schema ────────────────────────────────────────────────────────────

const MonthlyAnalysisOutputSchema = z.object({
    monthTitle: z
        .string()
        .describe("One direct sentence naming the month. E.g. 'Foundational growth and system building.'"),
    executiveSummary: z
        .string()
        .describe('4-5 sentences. The month in full honesty — direct and objective.'),
    overallScore: z
        .number().min(1).max(100)
        .describe('Overall alignment score for the month. 1-100.'),
    moodStory: z.object({
        arc: z
            .nativeEnum(MoodArc)
            .describe('The emotional arc across the 30-day period.'),
        bestWeek: z.string().describe('Date label for the highest-energy week (e.g. "Feb 10–16").'),
        hardestWeek: z.string().describe('Date label for the most difficult week.'),
        dominantEmotionalTheme: z
            .string()
            .describe("The emotional theme that ran through the whole month, e.g. 'Consistent focus.'"),
        sustainedPattern: z
            .string()
            .describe('A pattern only visible at 30-day view that would be invisible week-to-week.'),
    }),
    behavioralInsights: z.array(z.object({
        pattern: z.string().describe('The observable behavior pattern from the data.'),
        root: z.string().describe('Possible psychological or situational root cause.'),
        leverage: z.string().describe('How to flip this pattern into an advantage next month.'),
    })).describe('2-4 behavioral insights. Only include if evidence is strong.'),
    hardTruths: z.array(z.string())
        .max(4)
        .describe('Blunt, uncomfortable, data-backed truths. Not mean — just honest.'),
    documentedWins: z.array(z.object({
        win: z.string(),
        evidence: z.string().describe("Concrete backing: 'You logged gym 18/30 days.'"),
    })).describe('Only include wins that have verifiable data backing.'),
    comparedToLastMonth: z.object({
        scoreChange: z.number().describe('Change in overall score vs previous month. Positive = improvement.'),
        narrative: z.string().describe("E.g. 'Improved by 12 points compared to last month.'"),
        breakoutArea: z.string().optional().describe('The area that improved most vs last month.'),
        regressionArea: z.string().optional().describe('The area that declined most vs last month.'),
    }).optional().describe('Omit if no previous month report exists.'),
    nextMonthContract: z.object({
        themeSentence: z.string().describe("E.g. 'The next month focus is depth and technical execution.'"),
        topThreePriorities: z.array(z.string()).length(3),
        oneThingToStop: z.string(),
        oneThingToStart: z.string(),
        successDefinition: z.string().describe("'You'll know this month worked if...'"),
    }),
    stats: z.object({
        totalEntries: z.number(),
        totalWords: z.number(),
        avgDailyMood: z.number(),
        moodDataDays: z.number(),
        goalsActive: z.number(),
        topTags: z.array(z.string()),
        topEntities: z.array(z.string()),
        moodTimeSeries: z.array(z.number()).describe('Daily mood scores for sparkline (usually 30 points).'),
    }),
});

export type MonthlyAnalysisOutput = z.infer<typeof MonthlyAnalysisOutputSchema>;

// ─── Workflow ─────────────────────────────────────────────────────────────────

export class MonthlyAnalysisWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.MONTHLY_ANALYSIS;

    async execute(task: IAgentTaskDocument, emitProgress: ProgressCallback, signal: AbortSignal): Promise<AgentWorkflowResult> {
        const { userId, inputData } = task;
        try {
            await emitProgress('Building monthly context...');
            const result = await this.runMonthlyAnalysis(userId, inputData?.startDate, inputData?.endDate, emitProgress, signal);
            return { status: WorkflowStatus.COMPLETED, result };
        } catch (error: any) {
            if (error.message.includes('aborted')) {
                logger.warn(`Monthly Analysis aborted for user ${userId}`);
                return { status: WorkflowStatus.FAILED, error: 'Task aborted' };
            }
            logger.error(`Monthly Analysis failed for user ${userId}`, error);
            return { status: WorkflowStatus.FAILED, error: error.message };
        }
    }

    private async runMonthlyAnalysis(
        userId: string | Types.ObjectId,
        customStart?: string | Date,
        customEnd?: string | Date,
        emitProgress?: ProgressCallback,
        signal?: AbortSignal
    ): Promise<MonthlyAnalysisOutput> {
        logger.info(`Running Monthly Analysis for user ${userId}`);

        const now = new Date();
        const start = customStart ? new Date(customStart) : startOfMonth(now);
        const end = customEnd ? new Date(customEnd) : endOfMonth(now);

        const ctx = await reportContextBuilder.build(userId, start, end, ReportType.MONTHLY);

        if (ctx.totalEntries === 0) {
            return this.emptyMonthFallback();
        }

        if (emitProgress) await emitProgress('Analyzing monthly patterns...');

        const moodTimelineText = ctx.moodTimeSeries.length > 0
            ? ctx.moodTimeSeries.map(p => `${p.date}: ${p.score}/5`).join(', ')
            : 'No dedicated mood records. Use entry moodMetadata for approximation.';

        const personaContext = ctx.personaMarkdown
            ? `USER PERSONA (identity document — who this person fundamentally is):\n${ctx.personaMarkdown.substring(0, 2000)}`
            : '';

        // defensive read — support both current schema (overallScore/executiveSummary) and any legacy field names
        const previousContext = ctx.previousReport
            ? `PREVIOUS MONTH REPORT (for comparison):\nScore: ${ctx.previousReport.content?.overallScore ?? (ctx.previousReport.content as any)?.score ?? 'N/A'}/100\nSummary: ${ctx.previousReport.content?.executiveSummary ?? (ctx.previousReport.content as any)?.monthOverview ?? 'No summary'}`
            : '';

        const entityContext = ctx.topEntities.length > 0
            ? `PEOPLE/ENTITIES MENTIONED (with context from entries):\n${ctx.topEntities.join('\n')}`
            : '';

        const prompt = `
You are Brinn — a direct and data-driven personal analyst.
Perform the Monthly Analysis for the user. 

${personaContext}

ENTRIES THIS MONTH: ${ctx.totalEntries} total | ~${ctx.totalWords} words written

ENTRY NARRATIVE (chronological, last 30 days):
${ctx.entryNarrative || 'No entries recorded.'}

MOOD TIME-SERIES (dedicated tracker, 1-5 scale):
${moodTimelineText}

TOP TAGS THIS MONTH: ${ctx.topTags.slice(0, 15).join(', ') || 'None'}

${entityContext}

${previousContext}

CRITICAL INSTRUCTIONS:
- TONE: Use plain, direct English. Avoid being "hypersensational", "poetic", or "philosophical". No flowery metaphors or dramatic storytelling. Speak like an objective analyst.
- monthTitle: A direct, objective name for the month.
- moodStory.sustainedPattern: This must be something only detectable at 30 days.
- behavioralInsights: Root cause + leverage. Use persona context to make it resonate.
- hardTruths: Max 4 blunt, data-backed truths.
- documentedWins: Only include wins with hard numbers.
- comparedToLastMonth: ${ctx.previousReport ? 'REQUIRED — a previous month report exists above.' : 'OMIT — no previous report available.'}
- nextMonthContract: Specific numbers and actions, not platitudes.
- Do NOT sugarcoat stagnation.
- stats.totalEntries = ${ctx.totalEntries}, stats.totalWords = ${ctx.totalWords}, stats.avgDailyMood = ${ctx.avgMoodScore}
- Populate stats.moodTimeSeries with daily averages (approx 30 numbers).

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure EXACTLY:
{
  "monthTitle": "Direct sentence naming the month",
  "executiveSummary": "4-5 sentences. The month in objective detail",
  "overallScore": number (1-100),
  "moodStory": {
    "arc": "growth" | "decline" | "recovery" | "plateau" | "turbulent",
    "bestWeek": "Date range e.g. Feb 10-16",
    "hardestWeek": "Date range",
    "dominantEmotionalTheme": "theme of the month",
    "sustainedPattern": "pattern visible at 30-day view"
  },
  "behavioralInsights": [
    { "pattern": "string", "root": "string", "leverage": "string" }
  ],
  "hardTruths": ["truth 1", "truth 2"],
  "documentedWins": [
    { "win": "string", "evidence": "string" }
  ],
  "comparedToLastMonth": {
    "scoreChange": number,
    "narrative": "string",
    "breakoutArea": "string",
    "regressionArea": "string"
  },
  "nextMonthContract": {
    "themeSentence": "string",
    "topThreePriorities": ["string", "string", "string"],
    "oneThingToStop": "string",
    "oneThingToStart": "string",
    "successDefinition": "string"
  },
  "stats": {
    "totalEntries": number,
    "totalWords": number,
    "avgDailyMood": number,
    "moodDataDays": number,
    "goalsActive": 0,
    "topTags": ["tag1", "tag2"],
    "topEntities": ["entity1", "entity2"],
    "moodTimeSeries": [number]
  }
}

Return ONLY the JSON. No markdown blocks.
`;

        if (emitProgress) await emitProgress('Structuring context for language model...', { tokens: ctx.totalWords });
        if (emitProgress) await emitProgress('Synthesizing final analysis...');

        return llmService.generateJSON(prompt, MonthlyAnalysisOutputSchema, {
            temperature: 0.3,
            workflow: 'monthly_analysis',
            userId,
            signal
        });
    }

    private emptyMonthFallback(): MonthlyAnalysisOutput {
        return {
            monthTitle: "No data recorded this month.",
            executiveSummary: "No entries, goals, or mood data were logged. Without tracking, growth and patterns cannot be identified.",
            overallScore: 1,
            moodStory: {
                arc: MoodArc.PLATEAU,
                bestWeek: 'Unknown',
                hardestWeek: 'Unknown',
                dominantEmotionalTheme: 'No data logged.',
                sustainedPattern: 'No pattern visible due to lack of data.',
            },
            behavioralInsights: [{
                pattern: 'No logging activity.',
                root: 'Capture habit not established.',
                leverage: 'Start with brief daily entries to build the habit.',
            }],
            hardTruths: [
                "Growth requires consistent measurement.",
                "Lack of data prevents analysis and improvement.",
            ],
            documentedWins: [],
            nextMonthContract: {
                themeSentence: "Establish a daily logging habit.",
                topThreePriorities: ['Daily entry consistency', 'Activate at least one goal', 'Log mood every evening'],
                oneThingToStop: 'Letting days pass unrecorded.',
                oneThingToStart: 'A brief daily reflection.',
                successDefinition: "Establishment of a consistent capture routine.",
            },
            stats: {
                totalEntries: 0,
                totalWords: 0,
                avgDailyMood: 0,
                moodDataDays: 0,
                goalsActive: 0,
                topTags: [],
                topEntities: [],
                moodTimeSeries: Array(30).fill(0),
            },
        };
    }
}

export const monthlyAnalysisWorkflow = new MonthlyAnalysisWorkflow();
