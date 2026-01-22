import { NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { agentService } from './agent.service';
import { AgentTaskType } from './agent.types';

export class AgentController {
    public async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    public async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    public async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const tasks = await agentService.listUserTasks(userId);

            ResponseHelper.success(res, tasks, 'Agent tasks retrieved');
        } catch (error) {
            logger.error('Error listing agent tasks', error);
            ResponseHelper.error(res, 'Error listing agent tasks', 500, error);
        }
    }

    public async processNaturalLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { text } = req.body;
            const userId = (req as any).user._id;

            if (!text) {
                ResponseHelper.badRequest(res, 'Text input is required');
                return;
            }

            const processingResult = await agentService.processNaturalLanguage(userId, text);

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
}


export const agentController = new AgentController();
