import axios from 'axios';
import { logger } from '../../../config/logger';
import { MediaJobData } from '../media.types';
import { MediaSource } from '../media.enums';
import { mediaService } from '../media.service';
import { Media } from '../media.model';
import { config } from '../../../config/env';
import { visionService } from '../../agent/services/agent.vision.service'; // We can use vision service for video analysis too

/**
 * Process Video Job
 * Handles metadata extraction, thumbnail generation, and video content analysis.
 */
export async function processVideo(data: MediaJobData): Promise<any> {
    const { mediaId, userId, sourceType, whatsappData } = data;
    let videoBuffer: Buffer | null = null;
    let mimeType = 'video/mp4';

    logger.info('[Video Processor] Starting video job', { mediaId, userId, source: sourceType });

    try {
        // 1. Get the video source
        if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            logger.info('[Video Processor] Downloading WhatsApp video', { whatsappMediaId: whatsappData.mediaId });
            videoBuffer = await downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;
        } else {
            const result = await mediaService.getMediaBuffer(mediaId, userId);
            videoBuffer = result.buffer;
            mimeType = result.mimeType;
        }

        if (!videoBuffer) {
            throw new Error('Could not obtain video buffer');
        }

        // 2. Perform Video Analysis (Vision AI)
        // Gemini 1.5 can analyze videos passed as binary if they are small enough
        logger.info('[Video Processor] Analyzing video content with AI', { mediaId });
        const analysis = await analyzeVideo(videoBuffer, mimeType, userId);

        // 3. Update Media Record
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: 'ready',
                    'metadata.summary': analysis.summary,
                    'metadata.aiTags': analysis.tags,
                    'metadata.duration': analysis.duration,
                    'metadata.resolution': analysis.resolution
                }
            });
        }

        logger.info('[Video Processor] Video processing completed', { mediaId });
        return { analysis };

    } catch (error) {
        logger.error('[Video Processor] Video processing failed', { mediaId, error });
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
 * Uses Gemini Vision to analyze video content
 */
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
