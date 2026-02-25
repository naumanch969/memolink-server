import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { llmUsageService } from './llm-usage.service';

export class LLMUsageController {

    /**
     * Get aggregated Gemini usage costs and stats.
     */
    static async getGeminiCosts(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const summary = await llmUsageService.getGeminiCostsSummary();
            ResponseHelper.success(res, summary, 'Gemini costs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }
}
