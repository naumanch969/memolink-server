import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { captureService } from './capture.service';

export class CaptureController {
    constructor() {
        this.captureEntry = this.captureEntry.bind(this);
        this.captureWeb = this.captureWeb.bind(this);
        this.captureWhatsApp = this.captureWhatsApp.bind(this);
    }

    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            const entry = await captureService.captureEntry(userId, req.body);
            ResponseHelper.success(res, { status: 'queued', source: 'active-entry', entry });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    // 2. PASSIVE: Web Activity Sync (Browser Extension)
    async captureWeb(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            await captureService.captureWeb(userId, req.body);
            ResponseHelper.success(res, { status: 'queued', source: 'web-extension' });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    // 3. SOCIAL/WEBHOOK: WhatsApp Bot
    async captureWhatsApp(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            await captureService.captureWhatsApp(userId, req.body);
            ResponseHelper.success(res, { status: 'queued', source: 'whatsapp' });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }
}

export const captureController = new CaptureController();
