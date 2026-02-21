import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.util';
import { agentService } from './agent.service';
import { AgentTaskType } from './agent.types';
import { audioTranscriptionService } from './audio-transcription.service';
import { personaService } from './persona.service';

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

    /**
     * POST /agents/intent/audio
     * Accepts audio file upload, transcribes it, then runs through intent processing
     */
    static async processAudioIntent(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const file = req.file;

            if (!file) {
                ResponseHelper.badRequest(res, 'Audio file is required');
                return;
            }

            const tags = req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [];
            const timezone = req.body.timezone || undefined;

            // 1. Transcribe the audio
            logger.info('Starting audio transcription', { userId, mimeType: file.mimetype, size: file.size });
            const transcription = await audioTranscriptionService.transcribe(file.buffer, file.mimetype, { userId });

            if (!transcription.text) {
                ResponseHelper.success(res, {
                    transcription: '',
                    confidence: 'low',
                    intent: null,
                    task: null,
                    data: null,
                }, 'Audio was empty or inaudible');
                return;
            }

            // 2. Process through the normal NL intent pipeline
            const processingResult = await agentService.processNaturalLanguage(
                userId,
                transcription.text,
                {
                    tags,
                    timezone,
                    source: 'audio',
                }
            );

            ResponseHelper.success(res, {
                transcription: transcription.text,
                confidence: transcription.confidence,
                intent: processingResult.intent,
                task: processingResult.task,
                data: processingResult.result,
            }, 'Audio processed');
        } catch (error) {
            logger.error('Error processing audio intent', error);
            ResponseHelper.error(res, 'Error processing audio intent', 500, error);
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

    /**
     * Unified sync endpoint.
     * Use POST /agent/sync?type=persona for persona sync
     * Use POST /agent/sync for entry enhancement
     */
    static async syncLibrary(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const { entryId, force } = req.body;
            const type = req.query.type as string;

            if (type === 'persona') {
                const result = await agentService.syncPersona(userId, force);
                ResponseHelper.success(res, result, 'Persona sync task enqueued');
            } else {
                const result = await agentService.syncEntries(userId, entryId);
                ResponseHelper.success(res, result, 'Library enrichment tasks enqueued');
            }
        } catch (error) {
            logger.error('Error syncing library', error);
            ResponseHelper.error(res, 'Error syncing library', 500, error);
        }
    }

    static async getPersona(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            const persona = await personaService.getPersona(userId);
            ResponseHelper.success(res, persona, 'User persona retrieved');
        } catch (error) {
            logger.error('Error fetching user persona', error);
            ResponseHelper.error(res, 'Error fetching user persona', 500, error);
        }
    }

    static async cleanText(req: Request, res: Response): Promise<void> {
        try {
            const { text } = req.body;
            const userId = (req as any).user._id;

            if (!text) {
                ResponseHelper.badRequest(res, 'Text is required');
                return;
            }

            const cleanedText = await agentService.cleanText(userId, text);
            ResponseHelper.success(res, { cleanedText }, 'Text cleaned successfully');
        } catch (error) {
            logger.error('Error cleaning text', error);
            ResponseHelper.error(res, 'Error cleaning text', 500, error);
        }
    }
}

