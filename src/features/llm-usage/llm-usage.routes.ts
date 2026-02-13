import { Router } from 'express';
import { LLMUsageController } from './llm-usage.controller';

const router = Router();

// Routes are mounted under /admin/costs
router.get('/gemini', LLMUsageController.getGeminiCosts);

export const llmUsageAdminRouter = router;
