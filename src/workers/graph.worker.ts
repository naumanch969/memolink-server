import os from 'os';
import { logger } from '../config/logger';
import { eventStream } from '../core/events/event.stream';
import { EventType, MemolinkEvent } from '../core/events/event.types';
import { EdgeType, NodeType } from '../features/graph/edge.model';
import { graphService } from '../features/graph/graph.service';

export class GraphWorker {
    private isRunning = false;
    private readonly GROUP_NAME = 'graph_worker_group';
    private readonly CONSUMER_NAME = `consumer_${os.hostname()}_${process.pid}`;

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        logger.info('[GraphWorker] Initializing Consumer Group...');
        await eventStream.createGroup(this.GROUP_NAME);

        logger.info(`[GraphWorker] Started as ${this.CONSUMER_NAME}.`);
        this.loop();
    }

    private async loop() {
        while (this.isRunning) {
            try {
                // Read from consumer group (only new messages)
                const items = await eventStream.readGroup(this.GROUP_NAME, this.CONSUMER_NAME, 10);

                if (items.length === 0) {
                    continue;
                }

                for (const item of items) {
                    const { streamId, event } = item;

                    try {
                        // 1. Validate ID basics
                        const isValidId = (id: string) => id && id.length === 24 && /^[0-9a-fA-F]+$/.test(id);

                        if (event.userId && !isValidId(event.userId)) {
                            logger.warn(`[GraphWorker] Skipping event ${event.id}: Invalid userId ${event.userId}`);
                            await eventStream.ack(this.GROUP_NAME, streamId);
                            continue;
                        }

                        // 2. Process the event
                        await this.processEvent(event);

                        // 3. Acknowledge success to Redis
                        await eventStream.ack(this.GROUP_NAME, streamId);
                    } catch (err) {
                        logger.error(`[GraphWorker] Error processing event ${event.id}:`, err);
                        // In a more complex setup, we might XCLAIM or use a DLQ
                        // For now, we don't ACK, so it stays in the PEL (Pending Entires List)
                    }
                }

            } catch (error) {
                logger.error('[GraphWorker] Loop error', error);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    private async processEvent(event: MemolinkEvent) {
        logger.info(`[GraphWorker] Processing: ${event.type} (User: ${event.userId})`);

        switch (event.type) {
            case EventType.TASK_CREATED:
                await this.handleTaskCreated(event);
                break;

            case EventType.TASK_RESCHEDULED:
                await this.handleTaskRescheduled(event);
                break;

            // Future handlers: GOAL_COMPLETED, EMOTION_LOGGED, etc.
        }
    }

    private async handleTaskCreated(event: MemolinkEvent) {
        const { userId, payload } = event;
        const taskId = payload.taskId;
        const isValidId = (id: string) => id && id.length === 24 && /^[0-9a-fA-F]+$/.test(id);

        if (!isValidId(taskId)) return;

        await graphService.createEdge({
            fromId: userId,
            fromType: NodeType.USER,
            toId: taskId,
            toType: NodeType.TASK,
            relation: EdgeType.HAS_TASK,
            metadata: {
                origin: event.source.platform,
                title: payload.title
            }
        });
    }

    private async handleTaskRescheduled(event: MemolinkEvent) {
        const { userId, payload } = event;
        const taskId = payload.taskId;
        const isValidId = (id: string) => id && id.length === 24 && /^[0-9a-fA-F]+$/.test(id);

        if (!isValidId(taskId)) return;

        // Fetch current HAS_TASK edge to update count
        const edges = await graphService.getOutbounds(userId, EdgeType.HAS_TASK);
        const taskEdge = edges.find(e => e.to.id.toString() === taskId.toString());

        if (taskEdge) {
            const currentMetadata = (taskEdge.metadata || {}) as Record<string, unknown>;
            const currentCount = Number(currentMetadata.reschedule_count || 0);
            const newCount = currentCount + 1;

            const updatedMetadata = {
                ...currentMetadata,
                reschedule_count: newCount
            };

            await graphService.createEdge({
                fromId: userId,
                fromType: NodeType.USER,
                toId: taskId,
                toType: NodeType.TASK,
                relation: EdgeType.HAS_TASK,
                metadata: updatedMetadata
            });

            // Behavioral Deduction: Only trigger pattern once
            if (newCount === 3) {
                await graphService.createEdge({
                    fromId: userId,
                    fromType: NodeType.USER,
                    toId: taskId,
                    toType: NodeType.TASK,
                    relation: EdgeType.AVOIDS,
                    weight: 0.8,
                    metadata: {
                        title: currentMetadata.title || 'Untitled Task',
                        reason: '3+ reschedules detected',
                        pattern: 'avoidance'
                    }
                });
                logger.info(`[GraphWorker] ⚠️ Behavioral Pattern: User:${userId} -[AVOIDS]-> Task:${taskId}`);
            }
        }
    }
}

export const graphWorker = new GraphWorker();
