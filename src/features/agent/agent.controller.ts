import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AgentTaskType } from './agent.types';
import { agentService } from './services/agent.service';

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

    static async cancelTask(req: Request, res: Response): Promise<void> {
        try {
            const { taskId } = req.params;
            const userId = (req as any).user._id;

            const success = await agentService.cancelTask(taskId, userId);

            if (!success) {
                ResponseHelper.badRequest(res, 'Task not found or already in terminal state');
                return;
            }

            ResponseHelper.success(res, null, 'Agent task cancellation requested');
        } catch (error) {
            logger.error('Error cancelling agent task', error);
            ResponseHelper.error(res, 'Error cancelling agent task', 500, error);
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

    static async syncPersona(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const { force } = req.body;
            const result = await agentService.syncPersona(userId, force);
            ResponseHelper.success(res, result, 'Persona sync task enqueued');
        } catch (error) {
            logger.error('Error syncing persona', error);
            ResponseHelper.error(res, 'Error syncing persona', 500, error);
        }
    }

    static async getPersona(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const persona = await agentService.getPersona(userId);
            ResponseHelper.success(res, persona, 'User persona retrieved');
        } catch (error) {
            logger.error('Error fetching user persona', error);
            ResponseHelper.error(res, 'Error fetching user persona', 500, error);
        }
    }

}

