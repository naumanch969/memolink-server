import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../../../config/logger';
import { MediaJobData } from '../media.types';
import { MediaSource, MediaStatus } from '../media.enums';
import { audioTranscriptionService as geminiTranscription } from '../../agent/services/agent.audio.service'; // Direct one
import { mediaService } from '../media.service';
import { captureService } from '../../capture/capture.service';
import { Media } from '../media.model';
import axios from 'axios';
import { config } from '../../../config/env';

import { integrationRegistry } from '../../integrations/integration.registry';
import { IntegrationProviderIdentifier } from '../../integrations/integration.interface';
import { WhatsAppProvider } from '../../integrations/providers/whatsapp/whatsapp.provider';
import receptionService from '../../capture/reception.service';

// Set ffmpeg path
ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg');

/**
 * Process Audio Job
 * Handles transcoding to MP3 and transcription via Gemini.
 */
export async function processAudio(data: MediaJobData): Promise<any> {
    const { mediaId, userId, sourceType, whatsappData } = data;
    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/mpeg';

    logger.info('Processing audio job', { mediaId, userId, source: sourceType });

    try {
        // 1. Get the audio source
        if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            logger.info('Downloading WhatsApp media', { whatsappMediaId: whatsappData.mediaId });
            audioBuffer = await downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;
        } else {
            const result = await mediaService.getMediaBuffer(mediaId, userId);
            audioBuffer = result.buffer;
            mimeType = result.mimeType;
        }

        if (!audioBuffer) {
            throw new Error('Could not obtain audio buffer');
        }

        // 2. Transcode if needed (Standardization to MP3)
        // We always transcode to mp3 to ensure compatibility and better transcription
        const mp3Buffer = await transcodeToMp3(audioBuffer, mimeType);

        // 3. Transcribe
        logger.info('Transcribing audio', { mediaId, userId });
        const { text, confidence } = await geminiTranscription.transcribe(mp3Buffer, 'audio/mpeg', { userId });

        if (!text) {
            logger.warn('Transcription returned no text');
        }

        // 4. Update Media Record
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: MediaStatus.READY,
                    'metadata.ocrText': text, // Reuse ocrText for transcription for now or we can add transcriptionText field
                    'metadata.ocrConfidence': confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.7 : 0.4
                }
            });
        }

        // 5. If WhatsApp, handle the full flow
        if (sourceType === MediaSource.WHATSAPP && whatsappData && text) {
            logger.info('Handling WhatsApp post-transcription flow');

            // Capture
            const entry = await captureService.captureWhatsApp(userId, {
                from: whatsappData.from,
                body: text,
                isVoice: true,
                timestamp: new Date()
            });

            // Generate Response
            const response = await receptionService.generateResponse(userId, entry);

            if (response && whatsappData.from) {
                logger.info('Sending WhatsApp response', { to: whatsappData.from });
                const whatsappProvider = integrationRegistry.get(IntegrationProviderIdentifier.WHATSAPP) as WhatsAppProvider;
                await whatsappProvider.sendMessage(whatsappData.from, response);
            }
        }

        return { text, confidence };

    } catch (error) {
        logger.error('Audio processing failed', { mediaId, error });
        if (mediaId) {
            await Media.findByIdAndUpdate(mediaId, {
                $set: {
                    status: MediaStatus.FAILED,
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
    const apiToken = config.WHATSAPP_API_TOKEN || (config as any).whatsapp?.apiToken; // Fallback to whatever is in env

    // 1. Get Media URL
    const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${whatsappMediaId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
    });

    const url = mediaResponse.data.url;
    if (!url) throw new Error('Failed to get WhatsApp media URL');

    // 2. Download Media
    const downloadResponse = await axios.get(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
        responseType: 'arraybuffer'
    });

    return Buffer.from(downloadResponse.data);
}

/**
 * Transcodes any audio buffer to MP3
 */
async function transcodeToMp3(inputBuffer: Buffer, inputMime: string): Promise<Buffer> {
    if (inputMime === 'audio/mpeg' || inputMime === 'audio/mp3') {
        return inputBuffer;
    }

    return new Promise((resolve, reject) => {
        const tempInput = path.join(os.tmpdir(), `input_${Date.now()}`);
        const tempOutput = path.join(os.tmpdir(), `output_${Date.now()}.mp3`);

        fs.writeFileSync(tempInput, inputBuffer);

        ffmpeg(tempInput)
            .toFormat('mp3')
            .audioBitrate('128k')
            .on('error', (err) => {
                logger.error('FFmpeg transcoding error', err);
                cleanup();
                reject(err);
            })
            .on('end', () => {
                const outputBuffer = fs.readFileSync(tempOutput);
                cleanup();
                resolve(outputBuffer);
            })
            .save(tempOutput);

        const cleanup = () => {
            try {
                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            } catch (e) {
                logger.warn('Cleanup failed during transcoding', e);
            }
        };
    });
}
