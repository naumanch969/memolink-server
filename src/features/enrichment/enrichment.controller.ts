import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { enrichmentService } from './enrichment.service';
import { SignalTier } from './enrichment.types';

export class EnrichmentController {

    // Trigger a sync/healing batch for all entries in a pending or failed state.
    static async sync(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user._id;
            // Note: Enrichment healing currently scans across all users or can be targeted if we modify service.
            // For now, it respects the general healing logic.
            // We can add a manual trigger for a specific entry if entryId is provided.
            const { entryId } = req.body;

            if (entryId) {
                await enrichmentService.enqueueActiveEnrichment(userId.toString(), entryId, '', SignalTier.SIGNAL);
                ResponseHelper.success(res, null, 'Entry re-enrichment enqueued');
            } else {
                // Trigger general healing (background)
                enrichmentService.runEnrichmentHealingBatch().catch(err => {
                    logger.error('Manual enrichment healing trigger failed', err);
                });
                ResponseHelper.success(res, null, 'Enrichment healing batch triggered');
            }
        } catch (error) {
            logger.error('Error in enrichment sync controller', error);
            ResponseHelper.error(res, 'Failed to trigger enrichment sync', 500, error);
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

            const cleanedText = await enrichmentService.cleanText(userId, text);
            ResponseHelper.success(res, { cleanedText }, 'Text cleaned successfully');
        } catch (error) {
            logger.error('Error cleaning text', error);
            ResponseHelper.error(res, 'Error cleaning text', 500, error);
        }
    }
}
