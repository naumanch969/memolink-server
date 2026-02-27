import axios from 'axios';
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { Entry } from './entry.model';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_AUDIO_MODEL = 'gemini-1.5-flash';

async function downloadAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data).toString('base64');
    const mimeType = (response.headers['content-type'] as string) || 'audio/webm';
    return { base64, mimeType };
}

async function callGeminiAudio(base64: string, mimeType: string): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

    const body = {
        contents: [{
            parts: [
                {
                    inlineData: {
                        mimeType,
                        data: base64,
                    },
                },
                {
                    text: 'Please transcribe this audio recording accurately. Output only the transcribed text, no labels, no timestamps.',
                },
            ],
        }],
    };

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_AUDIO_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        body,
        { headers: { 'Content-Type': 'application/json' } }
    );

    const text: string = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
}

/**
 * Transcribes all audio media in an entry and patches the entry content.
 * Fire-and-forget: errors are logged but do not propagate.
 */
export async function transcribeAudioEntry(entryId: string, userId: string): Promise<void> {
    try {
        const entry = await Entry.findOne({
            _id: new Types.ObjectId(entryId),
            userId: new Types.ObjectId(userId),
        }).populate('media');

        if (!entry) {
            logger.warn('transcribeAudioEntry: entry not found', { entryId });
            return;
        }

        const audioMedia = (entry.media as any[]).filter(
            (m: any) => m?.type === 'audio' && m?.url
        );

        if (audioMedia.length === 0) {
            logger.info('transcribeAudioEntry: no audio media found, skipping', { entryId });
            return;
        }

        // Transcribe all audio files and join results
        const transcripts: string[] = [];
        for (const media of audioMedia) {
            try {
                const { base64, mimeType } = await downloadAsBase64(media.url);
                const transcript = await callGeminiAudio(base64, mimeType);
                if (transcript) transcripts.push(transcript);
            } catch (err) {
                logger.warn('transcribeAudioEntry: failed to transcribe one audio', { mediaId: media._id, err });
            }
        }

        if (transcripts.length === 0) {
            // Mark as failed so UI doesn't spin forever
            await Entry.findByIdAndUpdate(entryId, { status: 'failed' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                status: 'failed',
            });
            return;
        }

        const finalContent = [entry.content, ...transcripts].filter(Boolean).join('\n\n').trim();

        const updated = await Entry.findByIdAndUpdate(
            entryId,
            { content: finalContent, status: 'ready', aiProcessed: true },
            { new: true }
        ).populate(['mentions', 'tags', 'media', 'collectionId']);

        // Push live update to client
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, updated);

        logger.info('transcribeAudioEntry: completed', { entryId, charCount: finalContent.length });
    } catch (error) {
        logger.error('transcribeAudioEntry: unhandled error', { entryId, error });

        // Best-effort: mark failed so the UI doesn't stay in processing state
        try {
            await Entry.findByIdAndUpdate(entryId, { status: 'failed' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                status: 'failed',
            });
        } catch {
            logger.error('transcribeAudioEntry: failed to update entry status', { entryId, error });
         }
    }
}
