import { GeminiCostsSummary, LLMUsageEntry } from "./llm-usage.types";

export interface ILLMUsageService {
    computeCost(modelName: string, promptTokens: number, completionTokens: number): number;
    log(entry: LLMUsageEntry): void;
    getGeminiCostsSummary(): Promise<GeminiCostsSummary>;
}