import { logger } from '../../config/logger';
import { mediaService } from '../media/media.service';
import { audioTranscriptionService } from '../agent/services/agent.audio.service';
import entryService from './entry.service';
import { EntryStatus } from './entry.types';

/**
 * Wrapper for audio transcription on an Entry
 */
export async function transcribeAudioEntry(entryId: string, userId: string): Promise<void> {
    try {
        const entry = await entryService.getEntryById(entryId, userId);
        const audioMedia = (entry.media as any[]).find((m: any) => m?.type === 'audio');

        if (!audioMedia) {
            logger.warn(`No audio media found for entry ${entryId}`);
            return;
        }

        // Fetch audio buffer
        const { buffer, mimeType } = await mediaService.getMediaBuffer(audioMedia._id.toString(), userId);

        // Transcribe
        const { text } = await audioTranscriptionService.transcribe(buffer, mimeType, { userId });

        if (text) {
            // Update entry with transcribed text
            await entryService.updateEntry(entryId, userId, {
                content: entry.content ? `${entry.content}\n\n[Transcribed]: ${text}` : text,
                metadata: {
                    ...entry.metadata,
                    transcribed: true,
                    originalAudioId: audioMedia._id
                }
            });

            logger.info(`Entry ${entryId} audio transcribed and updated`);
        }
    } catch (error) {
        logger.error(`Failed to transcribe entry ${entryId}:`, error);
        
        // Mark as failed if it was in capturing/processing
        try {
            await entryService.updateEntry(entryId, userId, {
                status: EntryStatus.FAILED,
                metadata: { error: 'Audio transcription failed' }
            });
        } catch (e) {
            // ignore
        }
    }
}
