import { CaptureSource, MobileActivityPayload } from '../capture.interfaces';
import { BaseCaptureAdapter, NormalizedCapture } from './base.adapter';

export class MobileAppAdapter extends BaseCaptureAdapter<MobileActivityPayload | MobileActivityPayload[]> {
    readonly source: CaptureSource = 'mobile-app';

    /**
     * Translates OS-level app usage events into Passive intake logs.
     */
    async normalize(_userId: string, data: MobileActivityPayload | MobileActivityPayload[]): Promise<NormalizedCapture[]> {
        const rawEvents = Array.isArray(data) ? data : [data];

        return rawEvents.map(event => ({
            sourceType: 'passive',
            inputMethod: 'system',
            payload: {
                appName: event.appName,
                windowTitle: event.bundleId,
                activeSeconds: event.activeSeconds,
                interactionDensity: event.interactionCount || 0,
                metadata: {
                    platform: 'mobile',
                    bundleId: event.bundleId
                }
            },
            timestamp: event.timestamp ? new Date(event.timestamp) : new Date()
        }));
    }
}

export const mobileAppAdapter = new MobileAppAdapter();
