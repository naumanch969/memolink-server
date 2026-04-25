import { Entry } from '../../entry/entry.model';
import { EntryStatus } from '../../entry/entry.types';
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
import { config } from '../../../config/env';

import { integrationRegistry } from '../../integrations/integration.registry';
import { IntegrationProviderIdentifier } from '../../integrations/integration.interface';
import { WhatsAppProvider } from '../../integrations/providers/whatsapp/whatsapp.provider';
import receptionService from '../../capture/reception.service';

// Set ffmpeg path
if (config.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(config.FFMPEG_PATH);
}

// Handles transcoding to MP3 and transcription via Gemini.
export async function processAudio(data: MediaJobData): Promise<any> {
    const { mediaId, userId, entryId, sourceType, whatsappData } = data;
    let effectiveMediaId = mediaId;
    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/mpeg';

    logger.info('Processing audio job', { mediaId: effectiveMediaId, userId, entryId, source: sourceType });

    try {
        // 1. Get the audio source
        if (effectiveMediaId) {
            // Priority: Fetch from storage
            const result = await mediaService.getMediaBuffer(effectiveMediaId, userId);
            audioBuffer = result.buffer;
            mimeType = result.mimeType;
        } else if (sourceType === MediaSource.WHATSAPP && whatsappData) {
            // Fallback: Download from WhatsApp if no mediaId was provided
            logger.info('Downloading WhatsApp media as fallback', { whatsappMediaId: whatsappData.mediaId });
            audioBuffer = await mediaService.downloadWhatsAppMedia(whatsappData.mediaId);
            mimeType = whatsappData.mimeType;

            logger.info('Uploading fallback WhatsApp audio to Cloudinary');
            const media = await mediaService.uploadMediaFromBuffer(
                userId,
                audioBuffer,
                mimeType,
                `whatsapp_audio_${Date.now()}.ogg`
            );
            effectiveMediaId = media._id.toString();
        }

        if (!audioBuffer) {
            throw new Error('Could not obtain audio buffer');
        }

        // 2. Transcode if needed (Standardization to MP3)
        const mp3Buffer = await transcodeToMp3(audioBuffer, mimeType);

        // 3. Transcribe with enrichment
        logger.info('Transcribing audio with enrichment', { mediaId: effectiveMediaId, userId });
        const analysis = await geminiTranscription.transcribe(mp3Buffer, 'audio/mpeg', { userId });

        if (!analysis.text) {
            logger.warn('Transcription returned no text');
        }

        // 4. Update Media Record
        if (effectiveMediaId) {
            await Media.findByIdAndUpdate(effectiveMediaId, {
                $set: {
                    status: MediaStatus.READY,
                    'metadata.ocrText': analysis.text,
                    'metadata.ocrConfidence': analysis.confidence === 'high' ? 0.9 : analysis.confidence === 'medium' ? 0.7 : 0.4,
                    'metadata.summary': analysis.summary || analysis.text?.substring(0, 200),
                    'metadata.aiTags': analysis.tags ? analysis.tags.map(tag => ({ tag, confidence: 1.0 })) : [],
                    'metadata.language': analysis.language
                }
            });
        }

        // 5. Update Entry
        if (entryId) {
            const entry = await Entry.findById(entryId);
            if (entry) {
                entry.content = analysis.text || 'Audio content processed';
                entry.status = EntryStatus.COMPLETED;
                
                if (effectiveMediaId && !entry.media.includes(effectiveMediaId as any)) {
                    entry.media.push(effectiveMediaId as any);
                }

                // metadata.summary for search/preview
                entry.set('metadata.summary', analysis.summary || analysis.text?.substring(0, 200) || 'Audio entry');
                
                await entry.save(); // This will trigger pre('save') to set type = MIXED
                logger.info('Entry updated successfully after audio processing', { entryId, type: entry.type });

                // 6. Final WhatsApp Acknowledgment
                if (sourceType === MediaSource.WHATSAPP && whatsappData?.from) {
                    try {
                        const whatsapp = integrationRegistry.get(IntegrationProviderIdentifier.WHATSAPP) as WhatsAppProvider;
                        await whatsapp.sendMessage(
                            whatsappData.from, 
                            "Transcribed! I've updated your entry with the text. ✅"
                        );
                    } catch (err) {
                        logger.error('Failed to send WhatsApp completion message', err);
                    }
                }
            }
        }

        return analysis;

    } catch (error) {
        logger.error('Audio processing failed', { mediaId: effectiveMediaId, error });
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



// Transcodes any audio buffer to MP3
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
