import { ActivitySyncBatch } from '../../web-activity/web-activity.types';
import { CaptureSource } from '../capture.interfaces';
import { BaseCaptureAdapter, NormalizedCapture } from './base.adapter';

export class WebExtensionAdapter extends BaseCaptureAdapter<ActivitySyncBatch> {
    readonly source: CaptureSource = 'web-extension';

    /**
     * Translates a Browser Sync Batch into a series of passive contextual captures.
     */
    async normalize(_userId: string, data: ActivitySyncBatch): Promise<NormalizedCapture> {
        return {
            sourceType: 'passive',
            inputMethod: 'system',
            payload: {
                appName: 'Browser',
                activeSeconds: data.totalSeconds,
                metadata: {
                    syncId: data.syncId,
                    productiveSeconds: data.productiveSeconds,
                    distractingSeconds: data.distractingSeconds,
                    domainMap: data.domainMap
                }
            },
            timestamp: data.date ? new Date(data.date) : new Date()
        };
    }
}

export const webExtensionAdapter = new WebExtensionAdapter();
