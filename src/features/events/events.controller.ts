import { NextFunction, Response } from 'express';
import { logger } from '../../config/logger';
import { eventStream } from '../../core/events/EventStream';
import { EventType } from '../../core/events/types';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';

export class EventsController {
    /**
     * Ingests a batch of events from an Edge Client
     */
    static ingest = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const events = req.body.events; // Expecting array of { type, payload, timestamp, ... }

        if (!Array.isArray(events) || events.length === 0) {
            ResponseHelper.error(res, 'No events provided', 400);
            return
        }

        logger.info(`[EventsController] Ingesting ${events.length} events from ${userId}`);

        const results = [];
        for (const rawEvent of events) {
            try {
                // Validate Type
                if (!Object.values(EventType).includes(rawEvent.type)) {
                    results.push({ success: false, error: 'Invalid Event Type' });
                    continue;
                }

                // Publish to Stream
                // Note: We trust the timestamp from the client for "Sequence" but we might index by server reception time too.
                const id = await eventStream.publish(
                    rawEvent.type,
                    userId,
                    rawEvent.payload,
                    {
                        deviceId: rawEvent.source?.deviceId || 'unknown',
                        platform: rawEvent.source?.platform || 'web',
                        version: rawEvent.source?.version || '0.0.0'
                    },
                    {
                        clientTimestamp: rawEvent.timestamp,
                        is_offline_capture: rawEvent.meta?.is_offline_capture
                    }
                );
                results.push({ success: true, id });

            } catch (error) {
                logger.error('Failed to publish individual event', error);
                results.push({ success: false, error: 'Internal Error' });
            }
        }

        ResponseHelper.success(res, { results }, 'Events ingested');
    });
}
