import axios from 'axios';
import { config } from '../../../../config/env';
import { logger } from '../../../../config/logger';
import { audioTranscriptionService } from '../../../agent/services/agent.audio.service';
import { agentService } from '../../../agent/services/agent.service';
import { User } from '../../../auth/auth.model';
import { IWhatsAppProvider } from '../../whatsapp.interfaces';
import { WhatsAppConfigSchema } from './whatsapp.schema';
import { WhatsAppWebhookPayload } from './whatsapp.types';

export class WhatsAppProvider implements IWhatsAppProvider {
    private config;

    constructor() {
        // Validate config on initialization
        this.config = WhatsAppConfigSchema.parse({
            apiToken: config.WHATSAPP_API_TOKEN,
            phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
            verifyToken: config.WHATSAPP_VERIFY_TOKEN,
        });
    }

    private get apiUrl() {
        return `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}`;
    }

    /**
     * Handles incoming WhatsApp webhook events
     */
    async handleWebhook(data: WhatsAppWebhookPayload): Promise<void> {
        const entry = data.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return;

        const from = message.from;
        const user = await User.findOne({ whatsappNumber: from });

        if (!user) {
            logger.warn('WhatsApp message from unlinked number', { from });
            await this.sendMessage(from, "Your phone number is not linked to any MemoLink account. Please link it in your settings.");
            return;
        }

        try {
            if (message.type === 'text' && message.text) {
                await this.handleTextMessage(user._id.toString(), from, message.text.body);
            } else if (message.type === 'audio' && message.audio) {
                await this.handleAudioMessage(user._id.toString(), from, message.audio.id, message.audio.mime_type);
            } else {
                logger.debug('Unsupported WhatsApp message type', { type: message.type, from });
            }
        } catch (error) {
            logger.error('Error processing WhatsApp message', { error, from, userId: user._id });
            await this.sendMessage(from, "I'm sorry, I encountered an error processing your message.");
        }
    }

    private async handleTextMessage(userId: string, from: string, text: string) {
        const result = await agentService.processNaturalLanguage(userId, text, {
            source: 'whatsapp'
        });

        if (result.summary) {
            await this.sendMessage(from, result.summary);
        }
    }

    private async handleAudioMessage(userId: string, from: string, mediaId: string, mimeType: string) {
        logger.info('Processing WhatsApp audio', { mediaId, userId });

        const audioBuffer = await this.downloadMedia(mediaId);

        // 1. Transcribe the audio
        const transcription = await audioTranscriptionService.transcribe(audioBuffer, mimeType, { userId });

        if (!transcription.text) {
            await this.sendMessage(from, "I couldn't hear anything in that voice message.");
            return;
        }

        // 2. Process through the normal NL intent pipeline
        const result = await agentService.processNaturalLanguage(
            userId,
            transcription.text,
            {
                source: 'whatsapp',
                audioDetected: true
            }
        );

        if (result.summary) {
            await this.sendMessage(from, result.summary);
        }
    }

    /**
     * Downloads media from WhatsApp Cloud API
     */
    private async downloadMedia(mediaId: string): Promise<Buffer> {
        // 1. Get Media URL
        const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${this.config.apiToken}` }
        });

        const url = mediaResponse.data.url;
        if (!url) throw new Error('Failed to get WhatsApp media URL');

        // 2. Download Media
        const downloadResponse = await axios.get(url, {
            headers: { Authorization: `Bearer ${this.config.apiToken}` },
            responseType: 'arraybuffer'
        });

        return Buffer.from(downloadResponse.data);
    }

    /**
     * Sends a text message back to WhatsApp user
     */
    async sendMessage(to: string, text: string): Promise<void> {
        try {
            await axios.post(
                `${this.apiUrl}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: { body: text }
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.config.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error: any) {
            logger.error('Failed to send WhatsApp message', error.response?.data || error.message);
        }
    }

    /**
     * Webhook verification (GET request from Meta)
     */
    verifyWebhook(query: any): string | null {
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];

        if (mode === 'subscribe' && token === this.config.verifyToken) {
            logger.info('WhatsApp Webhook verified');
            return challenge;
        }
        return null;
    }
}

export const whatsappProvider = new WhatsAppProvider();
