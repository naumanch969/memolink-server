import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { CaptureSource } from './capture.interfaces';
import { captureService } from './capture.service';

export class CaptureController {
    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(req: Request, res: Response): Promise<void> {
        this.handleIngest(req, res, 'active-entry');
    }

    // 2. PASSIVE: Web Activity Sync (Browser Extension)
    async captureWeb(req: Request, res: Response): Promise<void> {
        this.handleIngest(req, res, 'web-extension');
    }

    // 3. SOCIAL/WEBHOOK: WhatsApp Bot
    async captureWhatsApp(req: Request, res: Response): Promise<void> {
        this.handleIngest(req, res, 'whatsapp');
    }

    // 4. APP LOGGING: Mobile/Desktop App Tracker
    async captureActivity(req: Request, res: Response): Promise<void> {
        const source = (req.body.platform === 'desktop' || req.body.source === 'desktop-app') ? 'desktop-app' : 'mobile-app';
        this.handleIngest(req, res, source as CaptureSource);
    }

    // Universal Terminal
    async capture(req: Request, res: Response): Promise<void> {
        const { source, payload } = req.body;
        this.handleIngest(req, res, source, payload);
    }

    /**
     * Common handler to reduce boilerplate.
     */
    private async handleIngest(req: Request, res: Response, source: CaptureSource, payload?: any): Promise<void> {
        const userId = (req as any).user?._id?.toString();
        const data = payload || req.body;

        try {
            await captureService.ingest(userId, source, data);
            ResponseHelper.success(res, { status: 'queued', source });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }
}

export const captureController = new CaptureController();
