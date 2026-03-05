import { StringUtil } from '../../../shared/utils/string.utils';
import { InputMethod } from '../../enrichment/enrichment.types';
import { CreateEntryRequest } from '../../entry/entry.types';
import { CaptureSource } from '../capture.interfaces';
import { BaseCaptureAdapter, NormalizedCapture } from './base.adapter';

export class ActiveEntryAdapter extends BaseCaptureAdapter<CreateEntryRequest & { _id?: string }> {
    readonly source: CaptureSource = 'active-entry';

    /**
     * Normalizes raw entry data and extracts signals (Mentions/Tags).
     * Pure transformation – no DB side effects.
     */
    async normalize(_userId: string, data: CreateEntryRequest & { _id?: string }): Promise<NormalizedCapture> {
        const content = data.content || '';

        // 1. Extract Signals (Non-LLM Intelligence)
        const extractedMentions = StringUtil.extractMentions(content);
        const extractedTags = StringUtil.extractTags(content);

        // 2. Determine InputMethod
        let method: InputMethod = 'text';
        if (data.type === 'media' || data.metadata?.isVoice) method = 'voice';
        if (data.metadata?.source === 'whatsapp') method = 'whatsapp';

        return {
            sourceType: 'active',
            inputMethod: method,
            payload: {
                rawText: content,
                metadata: {
                    referenceId: data._id,
                    originalType: data.type,
                    // Pass these as raw signals to be resolved by the service layer
                    extractedMentions,
                    extractedTags,
                    // Pass along existing IDs if provided
                    mentions: data.mentions || [],
                    tags: data.tags || [],
                    media: data.media,
                    collectionId: data.collectionId,
                    title: data.title,
                    location: data.location,
                    ...data.metadata
                }
            },
            timestamp: data.date ? new Date(data.date) : new Date()
        };
    }
}

export const activeEntryAdapter = new ActiveEntryAdapter();
