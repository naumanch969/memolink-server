import { logger } from '../../config/logger';
import { telemetryBus } from '../../core/telemetry/telemetry.bus';
import { LLMUsageLog } from './llm-usage.model';

// Gemini 2.5 Flash pricing (USD per token)
const PRICING_PER_TOKEN = {
    'gemini-2.5-flash': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
    'text-embedding-004': { input: 0.00 / 1_000_000, output: 0.00 / 1_000_000 }, // Free tier
} as const;

type PricedModel = keyof typeof PRICING_PER_TOKEN;

export interface LLMUsageEntry {
    userId: string;
    workflow: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
}

export interface GeminiCostsSummary {
    monthly: {
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        estimatedCostUSD: number;
        totalCalls: number;
    };
    dailyTrend: Array<{
        date: string;
        totalTokens: number;
        estimatedCostUSD: number;
        calls: number;
    }>;
    workflowBreakdown: Array<{
        workflow: string;
        totalTokens: number;
        estimatedCostUSD: number;
        calls: number;
        percentage: number;
    }>;
    averages: {
        tokensPerCall: number;
        costPerCall: number;
        tokensPerUser: number;
        callsPerDay: number;
    };
    projectedMonthEndCostUSD: number;
}

class LLMUsageService {

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

        // Optional: Still persist the raw log for granulary/audit, but do it asynchronously
        // For strict "No Bloat", we might skip this or push it to a low-priority queue.
        // But for now, let's keep it as a backup but wrap it safely.

        // We can delegate the cost calculation to the bus/buffer manager now, 
        // but we still need cost for the Log entry below if we keep it.
        // For consistency, let's recalculate it here just for the raw log document.
        const estimatedCostUSD = this.computeCost(entry.modelName, entry.promptTokens, entry.completionTokens);

        LLMUsageLog.create({
            ...entry,
            estimatedCostUSD,
        }).catch(err => {
            logger.error('Failed to persist LLM usage log', { error: err.message, entry });
        });
    }

    /**
     * Aggregates usage data for the admin Gemini costs dashboard.
     */
    async getGeminiCostsSummary(): Promise<GeminiCostsSummary> {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [monthlyAgg, dailyAgg, workflowAgg] = await Promise.all([
            this.aggregateMonthly(monthStart),
            this.aggregateDaily(monthStart),
            this.aggregateByWorkflow(monthStart),
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
}

export const llmUsageService = new LLMUsageService();
