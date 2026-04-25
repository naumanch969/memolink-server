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

// Handles text extraction, summarization, and key insight detection for PDFs/Documents.
export async function processDocument(data: MediaJobData): Promise<any> {
    const { mediaId, userId, entryId, sourceType, whatsappData } = data;
    let effectiveMediaId = mediaId;
    let documentBuffer: Buffer | null = null;
    let mimeType = 'application/pdf';

    logger.info('[Document Processor] Starting document job', { mediaId: effectiveMediaId, userId, entryId, source: sourceType });

    try {
        // 1. Get the document source
        if (effectiveMediaId) {
            // Priority: Fetch from storage
            const result = await mediaService.getMediaBuffer(effectiveMediaId, userId);
            documentBuffer = result.buffer;
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
            logger.info('[Document Processor] Downloading WhatsApp document as fallback', { whatsappMediaId: whatsappData.mediaId });
            documentBuffer = await mediaService.downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;

            logger.info('[Document Processor] Uploading fallback WhatsApp document to Cloudinary');
            const media = await mediaService.uploadMediaFromBuffer(
                userId,
                documentBuffer,
                mimeType,
                whatsappData.filename || `whatsapp_doc_${Date.now()}`
            );
            effectiveMediaId = media._id.toString();
        }

        if (!documentBuffer) {
            throw new Error('Could not obtain document buffer');
        }

        // 2. Perform Document Analysis (Using Gemini's Multimodal PDF support)
        if (entryId) {
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.ANALYZING_DOCUMENT }
            });
        }
        logger.info('[Document Processor] Analyzing document content with AI', { mediaId: effectiveMediaId });
        const analysis = await analyzeDocument(documentBuffer, mimeType, userId);

        // 3. Update Media Record
        if (effectiveMediaId) {
            await Media.findByIdAndUpdate(effectiveMediaId, {
                $set: {
                    status: MediaStatus.READY,
                    'metadata.ocrText': analysis.extractedText,
                    'metadata.summary': analysis.summary,
                    'metadata.aiTags': analysis.tags.map((tag: string) => ({ tag, confidence: 1.0 })),
                    'metadata.pages': analysis.pageCount
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
                if (originalContent && !originalContent.includes('WhatsApp Document')) {
                    entry.content = `${originalContent}\n\nAI Analysis: ${analysis.summary}`;
                } else {
                    entry.content = analysis.summary || 'Document content processed';
                }
                
                entry.status = EntryStatus.COMPLETED;
                if (effectiveMediaId && !entry.media.includes(effectiveMediaId as any)) {
                    entry.media.push(effectiveMediaId as any);
                }
                
                // metadata.summary for search/preview
                entry.set('metadata.summary', analysis.summary || 'Document entry');
                
                await entry.save(); // This will trigger pre('save') to set type = MIXED
                logger.info('[Document Processor] Entry updated successfully', { entryId, type: entry.type });

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
                            "Document analyzed! Summary and key insights are now in your vault. ✅"
                        );
                    } catch (err) {
                        logger.error('Failed to send WhatsApp completion message', err);
                    }
                }
            }
        }

        logger.info('[Document Processor] Document processing completed', { mediaId });
        return { analysis };

    } catch (error) {
        logger.error('[Document Processor] Document processing failed', { mediaId: effectiveMediaId, error });
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


// Uses Gemini to analyze document content
async function analyzeDocument(buffer: Buffer, mimeType: string, userId: string, originalName?: string): Promise<any> {
    try {
        const prompt = `Analyze this document thoroughly. ${originalName ? `The file is named: ${originalName}` : ''}
        
        1. Summary: Provide a 2-3 sentence executive summary of the document. ${originalName ? `Ensure you mention the filename "${originalName}" if relevant.` : ''}
        2. Extracted Text: Extract the most important text content (up to 5000 characters).
        3. Tags: Generate 5-10 descriptive tags for this document.
        4. Page Count: Estimate or detect the total number of pages.
        
        Output strictly valid JSON:
        {
            "summary": "...",
            "extractedText": "...",
            "tags": ["...", "..."],
            "pageCount": 0
        }`;

        const analysis = await visionService.analyze(buffer, mimeType, prompt, {
            userId,
            workflow: 'document-processing'
        });

        // Ensure the summary starts with the filename if provided, for better visibility in the timeline
        let finalSummary = analysis.summary || "No summary available.";
        if (originalName && !finalSummary.includes(originalName)) {
            finalSummary = `Document: ${originalName}\n\n${finalSummary}`;
        }

        return {
            summary: finalSummary,
            extractedText: analysis.extractedText || "",
            tags: analysis.tags || [],
            pageCount: analysis.pageCount || 1
        };
    } catch (error) {
        logger.error('[Document Processor] Document analysis failed', error);
        return {
            summary: "AI analysis failed for this document.",
            extractedText: "",
            tags: [],
            pageCount: 1
        };
    }
}
