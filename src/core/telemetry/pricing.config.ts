export interface PricingModel {
    input: number;  // Cost per million tokens (USD)
    output: number; // Cost per million tokens (USD)
}

// Pricing as of Feb 2026 (Hypothetical / Latest)
export const AI_PRICING: Record<string, PricingModel> = {
    'gemini-2.5-flash': { input: 0.10, output: 0.40 },
    'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'gemini-embedding-001': { input: 0.00, output: 0.00 },
};

export const STORAGE_PRICING = {
    cloudinary_gb: 0.15, // Approx cost per GB stored
    fly_egress_gb: 0.02, // Fly.io egress cost
};

export function calculateAICost(model: string, promptTokens: number, completionTokens: number): number {
    const price = AI_PRICING[model];
    if (!price) return 0;

    const inputCost = (promptTokens / 1_000_000) * price.input;
    const outputCost = (completionTokens / 1_000_000) * price.output;

    return inputCost + outputCost;
}
