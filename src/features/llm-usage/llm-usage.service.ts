import { logger } from '../../config/logger';
import { telemetryBus } from '../../core/telemetry/telemetry.bus';
import { GeminiCostsSummary, ILLMUsageService, LLMUsageEntry, LLMUsageLogDetail } from './llm-usage.interfaces';
import { LLMUsageLog } from './llm-usage.model';

// Gemini 2.5 Flash pricing (USD per token)
const PRICING_PER_TOKEN = {
    'gemini-2.5-flash': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
    'text-embedding-004': { input: 0.00 / 1_000_000, output: 0.00 / 1_000_000 }, // Free tier
} as const;

type PricedModel = keyof typeof PRICING_PER_TOKEN;


export class LLMUsageService implements ILLMUsageService {

    /**
     * Compute estimated cost for a single call based on model pricing.
     */
    computeCost(modelName: string, promptTokens: number, completionTokens: number): number {
        const pricing = PRICING_PER_TOKEN[modelName as PricedModel];
        if (!pricing) return 0;
        return (promptTokens * pricing.input) + (completionTokens * pricing.output);
    }

    /**
     * Fire-and-forget: emits a usage event to the telemetry bus.
     */
    log(entry: LLMUsageEntry): void {
        telemetryBus.emitAI({
            model: entry.modelName,
            promptTokens: entry.promptTokens,
            completionTokens: entry.completionTokens,
            feature: entry.workflow,
            userId: entry.userId,
        });

        const estimatedCostUSD = this.computeCost(entry.modelName, entry.promptTokens, entry.completionTokens);

        LLMUsageLog.create({ ...entry, estimatedCostUSD, })
            .catch(err => logger.error('Failed to persist LLM usage log', { error: err.message, entry }));
    }

    /**
     * Aggregates usage data for the admin Gemini costs dashboard.
     */
    async getGeminiCostsSummary(): Promise<GeminiCostsSummary> {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [monthlyAgg, dailyAgg, workflowAgg, recentLogs] = await Promise.all([
            this.aggregateMonthly(monthStart),
            this.aggregateDaily(monthStart),
            this.aggregateByWorkflow(monthStart),
            this.aggregateRecentLogs(50),
        ]);

        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedMonthEndCostUSD = dayOfMonth > 0
            ? (monthlyAgg.estimatedCostUSD / dayOfMonth) * daysInMonth
            : 0;

        const uniqueUsers = await this.countUniqueUsersThisMonth(monthStart);

        const averages = {
            tokensPerCall: monthlyAgg.totalCalls > 0
                ? Math.round(monthlyAgg.totalTokens / monthlyAgg.totalCalls)
                : 0,
            costPerCall: monthlyAgg.totalCalls > 0
                ? monthlyAgg.estimatedCostUSD / monthlyAgg.totalCalls
                : 0,
            tokensPerUser: uniqueUsers > 0
                ? Math.round(monthlyAgg.totalTokens / uniqueUsers)
                : 0,
            callsPerDay: dayOfMonth > 0
                ? Math.round(monthlyAgg.totalCalls / dayOfMonth)
                : 0,
        };

        // Compute percentage for each workflow
        const totalTokensAll = monthlyAgg.totalTokens || 1;
        const workflowBreakdown = workflowAgg.map(w => ({
            ...w,
            percentage: Math.round((w.totalTokens / totalTokensAll) * 100),
        }));

        return {
            monthly: monthlyAgg,
            dailyTrend: dailyAgg,
            workflowBreakdown,
            averages,
            projectedMonthEndCostUSD,
            recentLogs,
        };
    }

    private async aggregateMonthly(monthStart: Date) {
        const result = await LLMUsageLog.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            {
                $group: {
                    _id: null,
                    totalTokens: { $sum: '$totalTokens' },
                    promptTokens: { $sum: '$promptTokens' },
                    completionTokens: { $sum: '$completionTokens' },
                    estimatedCostUSD: { $sum: '$estimatedCostUSD' },
                    totalCalls: { $sum: 1 },
                }
            }
        ]);

        return result[0] ?? {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            estimatedCostUSD: 0,
            totalCalls: 0,
        };
    }

    private async aggregateDaily(monthStart: Date) {
        return LLMUsageLog.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    totalTokens: { $sum: '$totalTokens' },
                    estimatedCostUSD: { $sum: '$estimatedCostUSD' },
                    calls: { $sum: 1 },
                }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', totalTokens: 1, estimatedCostUSD: 1, calls: 1 } }
        ]);
    }

    private async aggregateByWorkflow(monthStart: Date) {
        return LLMUsageLog.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            {
                $group: {
                    _id: '$workflow',
                    totalTokens: { $sum: '$totalTokens' },
                    estimatedCostUSD: { $sum: '$estimatedCostUSD' },
                    calls: { $sum: 1 },
                }
            },
            { $sort: { totalTokens: -1 } },
            { $project: { _id: 0, workflow: '$_id', totalTokens: 1, estimatedCostUSD: 1, calls: 1 } }
        ]);
    }

    private async countUniqueUsersThisMonth(monthStart: Date): Promise<number> {
        const result = await LLMUsageLog.distinct('userId', {
            createdAt: { $gte: monthStart },
        });
        return result.length;
    }

    private async aggregateRecentLogs(limit: number): Promise<LLMUsageLogDetail[]> {
        const logs = await LLMUsageLog.find({})
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return logs.map((log: any) => ({
            _id: log._id.toString(),
            userId: log.userId?.toString() || '',
            workflow: log.workflow || 'unknown',
            modelName: log.modelName,
            promptTokens: log.promptTokens,
            completionTokens: log.completionTokens,
            totalTokens: log.totalTokens,
            estimatedCostUSD: log.estimatedCostUSD,
            durationMs: log.durationMs,
            createdAt: new Date(log.createdAt).toISOString(),
        }));
    }
}

export const llmUsageService = new LLMUsageService();
