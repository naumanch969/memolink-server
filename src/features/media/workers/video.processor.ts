import { Entry } from '../../entry/entry.model';
import { EntryStatus } from '../../entry/entry.types';
import { logger } from '../../../config/logger';
import { MediaJobData } from '../media.types';
import { MediaSource, MediaStatus } from '../media.enums';
import { mediaService } from '../media.service';
import { Media } from '../media.model';
import { visionService } from '../../agent/services/agent.vision.service';
import { integrationRegistry } from '../../integrations/integration.registry';
import { IntegrationProviderIdentifier } from '../../integrations/integration.interface';
import { WhatsAppProvider } from '../../integrations/providers/whatsapp/whatsapp.provider';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import { entryService } from '../../entry/entry.service';
import { ProcessingStep } from '../../enrichment/enrichment.types';

// Handles metadata extraction, thumbnail generation, and video content analysis.
export async function processVideo(data: MediaJobData): Promise<any> {
    const { mediaId, userId, entryId, sourceType, whatsappData } = data;
    let effectiveMediaId = mediaId;
    let videoBuffer: Buffer | null = null;
    let mimeType = 'video/mp4';

    logger.info('[Video Processor] Starting video job', { mediaId: effectiveMediaId, userId, entryId, source: sourceType });

    try {
        // 1. Get the video source
        if (effectiveMediaId) {
            // Priority: Fetch from storage
            const result = await mediaService.getMediaBuffer(effectiveMediaId, userId);
            videoBuffer = result.buffer;
            mimeType = result.mimeType;
        } else if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            // Fallback: Download from WhatsApp if no mediaId was provided
            if (entryId) {
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                    _id: entryId,
                    status: EntryStatus.PROCESSING,
                    metadata: { processingStep: ProcessingStep.DOWNLOADING_MEDIA }
                });
            }
            logger.info('[Video Processor] Downloading WhatsApp video as fallback', { whatsappMediaId: whatsappData.mediaId });
            videoBuffer = await mediaService.downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;

            logger.info('[Video Processor] Uploading fallback WhatsApp video to Cloudinary');
            const media = await mediaService.uploadMediaFromBuffer(
                userId,
                videoBuffer,
                mimeType,
                `whatsapp_video_${Date.now()}.mp4`
            );
            effectiveMediaId = media._id.toString();
        }

        if (!videoBuffer) {
            throw new Error('Could not obtain video buffer');
        }

        // 2. Perform Video Analysis (Vision AI)
        if (entryId) {
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.ANALYZING_VIDEO }
            });
        }
        logger.info('[Video Processor] Analyzing video content with AI', { mediaId: effectiveMediaId });
        const analysis = await analyzeVideo(videoBuffer, mimeType, userId);

        // 3. Update Media Record
        if (effectiveMediaId) {
            await Media.findByIdAndUpdate(effectiveMediaId, {
                $set: {
                    status: MediaStatus.READY,
                    'metadata.summary': analysis.summary,
                    'metadata.aiTags': analysis.tags.map((tag: string) => ({ tag, confidence: 1.0 })),
                    'metadata.duration': analysis.duration,
                    'metadata.resolution': analysis.resolution
                }
            });
        }

        // 4. Update Entry
        if (entryId) {
            const entry = await Entry.findById(entryId);
            if (entry) {
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                    _id: entryId,
                    metadata: { processingStep: ProcessingStep.TAGGING }
                });

                const originalContent = entry.content;
                // If there's an original caption, preserve it and append AI analysis
                if (originalContent && originalContent !== 'WhatsApp Video') {
                    entry.content = `${originalContent}\n\nAI Analysis: ${analysis.summary}`;
                } else {
                    entry.content = analysis.summary || 'Video content processed';
                }
                
                entry.status = EntryStatus.COMPLETED;
                if (effectiveMediaId && !entry.media.includes(effectiveMediaId as any)) {
                    entry.media.push(effectiveMediaId as any);
                }
                
                // metadata.summary for search/preview
                entry.set('metadata.summary', analysis.summary || 'Video entry');
                
                await entry.save(); // This will trigger pre('save') to set type = MIXED
                logger.info('[Video Processor] Entry updated successfully', { entryId, type: entry.type });

                // Emit socket event with fully populated entry
                const updatedEntry = await entryService.getEntryById(entryId.toString(), userId);
                if (updatedEntry) {
                    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updatedEntry);
                }

                // 5. Final WhatsApp Acknowledgment
                if (sourceType === MediaSource.WHATSAPP && whatsappData?.from) {
                    try {
                        const whatsapp = integrationRegistry.get(IntegrationProviderIdentifier.WHATSAPP) as WhatsAppProvider;
                        await whatsapp.sendMessage(
                            whatsappData.from, 
                            "Video processed! Summary and details are now in your timeline. ✅"
                        );
                    } catch (err) {
                        logger.error('Failed to send WhatsApp completion message', err);
                    }
                }
            }
        }

        logger.info('[Video Processor] Video processing completed', { mediaId });
        return { analysis };

    } catch (error) {
        logger.error('[Video Processor] Video processing failed', { mediaId: effectiveMediaId, error });
        if (effectiveMediaId) {
            await Media.findByIdAndUpdate(effectiveMediaId, {
                $set: {
                    status: MediaStatus.FAILED,
                    processingError: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
        throw error;
    }
}

// Uses Gemini Vision to analyze video content
async function analyzeVideo(buffer: Buffer, mimeType: string, userId: string): Promise<any> {
    try {
        const prompt = `Analyze this video file. 
        
        1. Summary: Provide a 1-2 sentence summary of what happens in the video.
        2. Tags: Extract 5-10 relevant keywords.
        3. Duration: Estimate the duration if possible.
        4. Content Description: Describe key visual elements.
        
        Output strictly valid JSON:
        {
            "summary": "...",
            "tags": ["...", "..."],
            "duration": 0,
            "resolution": "unknown"
        }`;

        // Note: Gemini 1.5 supports video in generateContent
        const analysis = await visionService.analyze(buffer, mimeType, prompt, {
            userId,
            workflow: 'video-processing'
        });

        return {
            summary: analysis.summary || "No summary available.",
            tags: analysis.tags || [],
            duration: analysis.duration || 0,
            resolution: analysis.resolution || "detected"
        };
    } catch (error) {
        logger.error('[Video Processor] Video analysis failed', error);
        return {
            summary: "AI analysis failed for this video.",
            tags: [],
            duration: 0,
            resolution: "unknown"
        };
    }
}
