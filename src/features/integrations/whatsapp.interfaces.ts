import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from './providers/whatsapp/whatsapp.types';

export interface IWhatsAppProvider {
    handleWebhook(data: WhatsAppWebhookPayload): Promise<void>;
    sendMessage(to: string, text: string): Promise<void>;
    verifyWebhook(query: any): string | null;
}

export interface IWhatsAppController {
    verify(req: Request, res: Response): Promise<void>;
    receive(req: Request, res: Response): Promise<void>;
}
