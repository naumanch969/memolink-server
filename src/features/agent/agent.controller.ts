import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { agentService } from './agent.service';
import { AgentTaskType } from './agent.types';

export class AgentController {
    static async createTask(req: Request, res: Response): Promise<void> {
        try {
            const { type, inputData } = req.body;
            const userId = (req as any).user._id;

            if (!Object.values(AgentTaskType).includes(type)) {
                ResponseHelper.badRequest(res, 'Invalid agent task type');
                return;
            }

            const task = await agentService.createTask(userId, type, inputData || {});
            ResponseHelper.created(res, task, 'Agent task created');
        } catch (error) {
            logger.error('Error creating agent task', error);
            ResponseHelper.error(res, 'Error creating agent task', 500, error);
        }
    }

    static async getTask(req: Request, res: Response): Promise<void> {
        try {
            const { taskId } = req.params;
            const userId = (req as any).user._id;

            const task = await agentService.getTask(taskId, userId);

            if (!task) {
                ResponseHelper.notFound(res, 'Agent task not found');
                return;
            }

            ResponseHelper.success(res, task, 'Agent task retrieved');
        } catch (error) {
            logger.error('Error fetching agent task', error);
            ResponseHelper.error(res, 'Error fetching agent task', 500, error);
        }
    }

    static async listTasks(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const tasks = await agentService.listUserTasks(userId);

            ResponseHelper.success(res, tasks, 'Agent tasks retrieved');
        } catch (error) {
            logger.error('Error listing agent tasks', error);
            ResponseHelper.error(res, 'Error listing agent tasks', 500, error);
        }
    }

    static async processNaturalLanguage(req: Request, res: Response): Promise<void> {
        try {
            const { text, tags, timezone } = req.body;
            const userId = (req as any).user._id;

            if (!text) {
                ResponseHelper.badRequest(res, 'Text input is required');
                return;
            }

            const processingResult = await agentService.processNaturalLanguage(userId, text, { tags, timezone });

            ResponseHelper.success(res, {
                intent: processingResult.intent,
                task: processingResult.task,
                data: processingResult.result
            }, 'Processed');
        } catch (error) {
            logger.error('Error processing natural language', error);
            ResponseHelper.error(res, 'Error processing natural language', 500, error);
        }
    }

    static async chat(req: Request, res: Response): Promise<void> {
        try {
            const { message } = req.body;
            const userId = (req as any).user._id;

            if (!message) {
                ResponseHelper.badRequest(res, 'Message is required');
                return;
            }

            const response = await agentService.chat(userId, message);
            ResponseHelper.success(res, { response }, 'Chat response');
        } catch (error) {
            logger.error('Error in agent chat', error);
            ResponseHelper.error(res, 'Error in agent chat', 500, error);
        }
    }

    static async clearHistory(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            await agentService.clearHistory(userId);
            ResponseHelper.success(res, null, 'Chat history cleared');
        } catch (error) {
            logger.error('Error clearing chat history', error);
            ResponseHelper.error(res, 'Error clearing chat history', 500, error);
        }
    }

    static async getHistory(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const history = await agentService.getChatHistory(userId);
            ResponseHelper.success(res, history, 'Chat history retrieved');
        } catch (error) {
            logger.error('Error fetching chat history', error);
            ResponseHelper.error(res, 'Error fetching chat history', 500, error);
        }
    }

    static async getBriefing(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const briefing = await agentService.getDailyBriefing(userId);
            ResponseHelper.success(res, { briefing }, 'Daily briefing generated');
        } catch (error) {
            logger.error('Error generating daily briefing', error);
            ResponseHelper.error(res, 'Error generating daily briefing', 500, error);
        }
    }

    static async getSimilarEntries(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const text = req.query.text as string;
            if (!text) {
                ResponseHelper.error(res, 'Text query is required', 400);
                return;
            }
            const results = await agentService.findSimilarEntries(userId, text, 3);
            ResponseHelper.success(res, results, 'Similar entries found');
        } catch (error) {
            logger.error('Error finding similar entries', error);
            ResponseHelper.error(res, 'Error finding similar entries', 500, error);
        }
    }

    static async goalArchitectChat(req: Request, res: Response): Promise<void> {
        try {
            const { message, history } = req.body;
            const userId = (req as any).user._id;

            if (!message) {
                ResponseHelper.badRequest(res, 'Message is required');
                return;
            }

            const response = await agentService.goalArchitect(userId, message, history || []);
            ResponseHelper.success(res, { response }, 'Goal architect response');
        } catch (error) {
            logger.error('Error in goal architect chat', error);
            ResponseHelper.error(res, 'Error in goal architect chat', 500, error);
        }
    }

    static async syncEntries(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const { entryId } = req.body;

            const result = await agentService.syncEntries(userId, entryId);
            ResponseHelper.success(res, result, 'Library sync tasks enqueued');
        } catch (error) {
            logger.error('Error syncing library entries', error);
            ResponseHelper.error(res, 'Error syncing library entries', 500, error);
        }
    }
}

