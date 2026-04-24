import axios from 'axios';
import { logger } from '../../../config/logger';
import { MediaJobData } from '../media.types';
import { MediaSource } from '../media.enums';
import { mediaService } from '../media.service';
import { Media } from '../media.model';
import { config } from '../../../config/env';
import { visionService } from '../../agent/services/agent.vision.service';

/**
 * Process Document Job
 * Handles text extraction, summarization, and key insight detection for PDFs/Documents.
 */
export async function processDocument(data: MediaJobData): Promise<any> {
    const { mediaId, userId, sourceType, whatsappData } = data;
    let documentBuffer: Buffer | null = null;
    let mimeType = 'application/pdf';

    logger.info('[Document Processor] Starting document job', { mediaId, userId, source: sourceType });

    try {
        // 1. Get the document source
        if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            logger.info('[Document Processor] Downloading WhatsApp document', { whatsappMediaId: whatsappData.mediaId });
            documentBuffer = await downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;
        } else {
            const result = await mediaService.getMediaBuffer(mediaId, userId);
            documentBuffer = result.buffer;
            mimeType = result.mimeType;
        }

        if (!documentBuffer) {
            throw new Error('Could not obtain document buffer');
        }

        // 2. Perform Document Analysis (Using Gemini's Multimodal PDF support)
        logger.info('[Document Processor] Analyzing document content with AI', { mediaId });
        const analysis = await analyzeDocument(documentBuffer, mimeType, userId);

        // 3. Update Media Record
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: 'ready',
                    'metadata.ocrText': analysis.extractedText,
                    'metadata.summary': analysis.summary,
                    'metadata.aiTags': analysis.tags,
                    'metadata.pages': analysis.pageCount
                }
            });
        }

        logger.info('[Document Processor] Document processing completed', { mediaId });
        return { analysis };

    } catch (error) {
        logger.error('[Document Processor] Document processing failed', { mediaId, error });
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: 'error',
                    processingError: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
        throw error;
    }
}

/**
 * Downloads media from WhatsApp Cloud API
 */
async function downloadWhatsAppMedia(whatsappMediaId: string): Promise<Buffer> {
    const apiToken = config.WHATSAPP_API_TOKEN;
    
    const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${whatsappMediaId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
    });

    const url = mediaResponse.data.url;
    if (!url) throw new Error('Failed to get WhatsApp media URL');

    const downloadResponse = await axios.get(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
        responseType: 'arraybuffer'
    });

    return Buffer.from(downloadResponse.data);
}

/**
 * Uses Gemini to analyze document content
 */
async function analyzeDocument(buffer: Buffer, mimeType: string, userId: string): Promise<any> {
    try {
        const prompt = `Analyze this document thoroughly. 
        
        1. Summary: Provide a 2-3 sentence executive summary of the document.
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
        
        return {
            summary: analysis.summary || "No summary available.",
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
