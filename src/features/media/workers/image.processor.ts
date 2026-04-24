import sharp from 'sharp';
import axios from 'axios';
import { logger } from '../../../config/logger';
import { MediaJobData } from '../media.types';
import { MediaSource } from '../media.enums';
import { mediaService } from '../media.service';
import { Media } from '../media.model';
import { config } from '../../../config/env';
import { visionService } from '../../agent/services/agent.vision.service';


// Process Image Job
export async function processImage(data: MediaJobData): Promise<any> {
    const { mediaId, userId, sourceType, whatsappData } = data;
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    logger.info('[Image Processor] Starting image job', { mediaId, userId, source: sourceType });

    try {
        // 1. Get the image source
        if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            logger.info('[Image Processor] Downloading WhatsApp image', { whatsappMediaId: whatsappData.mediaId });
            imageBuffer = await downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;
        } else {
            const result = await mediaService.getMediaBuffer(mediaId, userId);
            imageBuffer = result.buffer;
            mimeType = result.mimeType;
        }

        if (!imageBuffer) {
            throw new Error('Could not obtain image buffer');
        }

        // 2. Perform Image Analysis (Vision)
        // Similar to audio transcription, we use Gemini to "see" the image
        logger.info('[Image Processor] Analyzing image content with Vision AI', { mediaId });
        const analysis = await analyzeImage(imageBuffer, mimeType, userId);

        // 3. Extract EXIF / Metadata using Sharp
        const metadata = await sharp(imageBuffer).metadata();

        // 4. Update Media Record
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: 'ready',
                    'metadata.width': metadata.width,
                    'metadata.height': metadata.height,
                    'metadata.ocrText': analysis.ocrText,
                    'metadata.aiTags': analysis.tags,
                    'metadata.colors': analysis.dominantColors,
                    'metadata.summary': analysis.description
                }
            });
        }

        logger.info('[Image Processor] Image processing completed', { mediaId });
        return { analysis, metadata: { width: metadata.width, height: metadata.height } };

    } catch (error) {
        logger.error('[Image Processor] Image processing failed', { mediaId, error });
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


// Downloads media from WhatsApp Cloud API
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
