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