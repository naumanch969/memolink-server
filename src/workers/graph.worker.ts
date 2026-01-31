import { logger } from '../config/logger';
import { eventStream } from '../core/events/EventStream';
import { EventType, MemolinkEvent } from '../core/events/types';
import { EdgeType, NodeType } from '../features/graph/edge.model';
import { graphService } from '../features/graph/graph.service';

export class GraphWorker {
    private isRunning = false;
    private lastId = '0-0'; // Start from beginning for now

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info('[GraphWorker] Started.');

        this.loop();
    }

    private async loop() {
        while (this.isRunning) {
            try {
                // Read batch of events
                const events = await eventStream.read(this.lastId, 10);

                if (events.length === 0) {
                    // Backoff if empty
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                for (const item of events) {
                    const { streamId, event } = item;
                    await this.processEvent(event);
                    // Update cursor strictly after processing (At-Least-Once semantics)
                    this.lastId = streamId;
                }

            } catch (error) {
                logger.error('[GraphWorker] Loop error', error);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    private async processEvent(event: MemolinkEvent) {
        logger.debug(`[GraphWorker] Processing ${event.type}`);

        switch (event.type) {
            case EventType.TASK_CREATED:
                await this.handleTaskCreated(event);
                break;

            case EventType.TASK_COMPLETED:
                // Removing the HAS_TASK edge or marking it?
                // Graph is "Current State". If done, maybe remove HAS_TASK? 
                // Or change relation to COMPLETED_TASK?
                // For now, let's just keep strict simple logic.
                // We keep the edge, maybe update metadata.
                break;

            case EventType.TASK_RESCHEDULED:
                // This is where "AVOIDS" logic will live later.
                break;
        }
    }

    private async handleTaskCreated(event: MemolinkEvent) {
        const { userId, payload } = event;
        const taskId = payload.taskId; // Typed payload? check types.ts
        // In types.ts, payloads are generic T. We assume simple shape for now or define strict interface.

        await graphService.createEdge({
            fromId: userId,
            fromType: NodeType.USER,
            toId: taskId,
            toType: NodeType.TASK,
            relation: EdgeType.HAS_TASK,
            metadata: {
                origin: event.source.platform
            }
        });

        logger.info(`[GraphWorker] Created Edge: User:${userId} -[HAS_TASK]-> Task:${taskId}`);
    }
}

// Singleton worker for V0
export const graphWorker = new GraphWorker();
