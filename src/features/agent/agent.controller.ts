import { NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';
import { agentService } from './agent.service';
import { AgentTaskType } from './agent.types';

export class AgentController {
    public async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { type, inputData } = req.body;
            // Assuming strict authentication middleware is used and user is attached to request
            const userId = (req as any).user._id;

            if (!Object.values(AgentTaskType).includes(type)) {
                res.status(400).json({ message: 'Invalid agent task type' });
                return;
            }

            const task = await agentService.createTask(userId, type, inputData || {});

            res.status(201).json({
                message: 'Agent task created',
                task,
            });
        } catch (error) {
            logger.error('Error creating agent task', error);
            next(error);
        }
    }

    public async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { taskId } = req.params;
            const userId = (req as any).user._id;

            const task = await agentService.getTask(taskId, userId);

            if (!task) {
                res.status(404).json({ message: 'Agent task not found' });
                return;
            }

            res.status(200).json({ task });
        } catch (error) {
            logger.error('Error fetching agent task', error);
            next(error);
        }
    }

    public async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const tasks = await agentService.listUserTasks(userId);

            res.status(200).json({ tasks });
        } catch (error) {
            logger.error('Error listing agent tasks', error);
            next(error);
        }
    }

    public async processNaturalLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { text } = req.body;
            const userId = (req as any).user._id;

            if (!text) {
                res.status(400).json({ message: 'Text input is required' });
                return;
            }

            const processingResult = await agentService.processNaturalLanguage(userId, text);

            res.status(200).json({
                message: 'Processed',
                intent: processingResult.intent,
                task: processingResult.task,
                data: processingResult.result
            });
        } catch (error) {
            logger.error('Error processing natural language', error);
            next(error);
        }
    }
}


export const agentController = new AgentController();
