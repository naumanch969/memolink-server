import { Entry } from '../../entry/entry.model';
import { EntryStatus } from '../../entry/entry.types';
import sharp from 'sharp';
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


// Process Image Job
export async function processImage(data: MediaJobData): Promise<any> {
    const { mediaId, userId, entryId, sourceType, whatsappData } = data;
    let effectiveMediaId = mediaId;
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    logger.info('[Image Processor] Starting image job', { mediaId: effectiveMediaId, userId, entryId, source: sourceType });

    try {
        // 1. Get the image source
        if (effectiveMediaId) {
            // Priority: Fetch from storage
            const result = await mediaService.getMediaBuffer(effectiveMediaId, userId);
            imageBuffer = result.buffer;
            mimeType = result.mimeType;
        } else if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            // Fallback: Download from WhatsApp if no mediaId was provided
            if (entryId) {
                await Entry.findByIdAndUpdate(entryId, {
                    status: EntryStatus.PROCESSING,
                    'metadata.processingStep': ProcessingStep.DOWNLOADING_MEDIA
                });
                const updated = await entryService.getEntryById(entryId.toString(), userId);
                if (updated) {
                    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updated);
                }
            }
            logger.info('[Image Processor] Downloading WhatsApp image as fallback', { whatsappMediaId: whatsappData.mediaId });
            imageBuffer = await mediaService.downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;

            logger.info('[Image Processor] Uploading fallback WhatsApp image to Cloudinary');
            const media = await mediaService.uploadMediaFromBuffer(
                userId,
                imageBuffer,
                mimeType,
                `whatsapp_image_${Date.now()}.jpg`
            );
            effectiveMediaId = media._id.toString();
        }

        if (!imageBuffer) {
            throw new Error('Could not obtain image buffer');
        }

        // 2. Perform Image Analysis (Vision)
        if (entryId) {
            await Entry.findByIdAndUpdate(entryId, {
                'metadata.processingStep': ProcessingStep.ANALYZING_IMAGE
            });
            const updated = await entryService.getEntryById(entryId.toString(), userId);
            if (updated) {
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updated);
            }
        }
        logger.info('[Image Processor] Analyzing image content with Vision AI', { mediaId: effectiveMediaId });
        const analysis = await analyzeImage(imageBuffer, mimeType, userId);

        // 3. Extract EXIF / Metadata using Sharp
        const metadata = await sharp(imageBuffer).metadata();

        // 4. Update Media Record
        if (effectiveMediaId) {
            await Media.findByIdAndUpdate(effectiveMediaId, {
                $set: {
                    status: MediaStatus.READY,
                    'metadata.width': metadata.width,
                    'metadata.height': metadata.height,
                    'metadata.ocrText': analysis.ocrText,
                    'metadata.aiTags': analysis.tags.map((tag: string) => ({ tag, confidence: 1.0 })),
                    'metadata.colors': analysis.dominantColors,
                    'metadata.summary': analysis.description
                }
            });
        }

        // 5. Update Entry
        if (entryId) {
            const entry = await Entry.findById(entryId);
            if (entry) {
                await Entry.findByIdAndUpdate(entryId, {
                    'metadata.processingStep': ProcessingStep.TAGGING
                });
                const updated = await entryService.getEntryById(entryId.toString(), userId);
                if (updated) {
                    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updated);
                }

                const originalContent = entry.content;
                // If there's an original caption, preserve it and append AI analysis
                if (originalContent && originalContent !== 'WhatsApp Image') {
                    entry.content = `${originalContent}\n\nAI Analysis: ${analysis.description}`;
                } else {
                    entry.content = analysis.description || 'Image content processed';
                }
                
                entry.status = EntryStatus.COMPLETED;
                if (effectiveMediaId && !entry.media.includes(effectiveMediaId as any)) {
                    entry.media.push(effectiveMediaId as any);
                }
                
                // metadata.summary for search/preview
                entry.set('metadata.summary', analysis.description || 'Image entry');
                
                await entry.save(); // This will trigger pre('save') to set type = MIXED
                logger.info('[Image Processor] Entry updated successfully', { entryId, type: entry.type });

                // Emit socket event with fully populated entry
                const updatedEntry = await entryService.getEntryById(entryId.toString(), userId);
                if (updatedEntry) {
                    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updatedEntry);
                }

                // 6. Final WhatsApp Acknowledgment
                if (sourceType === MediaSource.WHATSAPP && whatsappData?.from) {
                    try {
                        const whatsapp = integrationRegistry.get(IntegrationProviderIdentifier.WHATSAPP) as WhatsAppProvider;
                        await whatsapp.sendMessage(
                            whatsappData.from, 
                            "Analysis complete! I've added the details to your entry. ✅"
                        );
                    } catch (err) {
                        logger.error('Failed to send WhatsApp completion message', err);
                    }
                }
            }
        }

        logger.info('[Image Processor] Image processing completed', { mediaId });
        return { analysis, metadata: { width: metadata.width, height: metadata.height } };

    } catch (error) {
        logger.error('[Image Processor] Image processing failed', { mediaId: effectiveMediaId, error });
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



// Uses Gemini Vision to analyze image content
async function analyzeImage(buffer: Buffer, mimeType: string, userId: string): Promise<any> {
    try {
        const prompt = `Analyze this image thoroughly for the user's personal knowledge base.
        
        1. Description: Provide a concise (1-2 sentences) but descriptive summary of what's in the image.
        2. Tags: Extract 5-10 highly relevant keywords/tags.
        3. Text: If there is any readable text (OCR), extract it perfectly.
        4. Colors: Identify 3 dominant colors in hex format.
        
        Output strictly valid JSON:
        {
            "description": "...",
            "tags": ["...", "..."],
            "ocrText": "...",
            "dominantColors": ["#...", "#..."]
        }`;

        const analysis = await visionService.analyze(buffer, mimeType, prompt, {
            userId,
            workflow: 'image-processing'
        });

        return {
            description: analysis.description || "No description provided.",
            tags: analysis.tags || [],
            ocrText: analysis.ocrText || "",
            dominantColors: analysis.dominantColors || []
        };
    } catch (error) {
        logger.error('[Image Processor] Vision analysis failed', error);
        return {
            description: "Vision analysis failed",
            tags: [],
            ocrText: "",
            dominantColors: []
        };
    }
}
