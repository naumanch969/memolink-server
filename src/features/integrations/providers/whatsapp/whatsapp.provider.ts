import axios from 'axios';
import { config } from '../../../../config/env';
import { logger } from '../../../../config/logger';
import { CacheKeys } from '../../../../core/cache/cache.keys';
import cacheService from '../../../../core/cache/cache.service';
import { captureService } from '../../../capture/capture.service';
import { receptionService } from '../../../capture/reception.service';
import { User } from '../../../auth/auth.model';
import { Notification } from '../../../notification/notification.model';
import { socketService } from '../../../../core/socket/socket.service';
import { SocketEvents } from '../../../../core/socket/socket.types';
import { IWhatsAppProvider } from '../../whatsapp.interfaces';
import { WhatsAppWebhookPayload } from './whatsapp.types';
import { IIntegrationProvider, IntegrationProviderIdentifier } from '../../integration.interface';
import { IIntegrationTokenDocument } from '../../integration.model';
import { MediaJobType } from '../../../media/media.types';
import { addMediaJob } from '../../../media/media.queue';
import { MediaSource } from '../../../media/media.enums';

// TODO: check if we need to remvoe the audio handling by agent module
export class WhatsAppProvider implements IWhatsAppProvider, IIntegrationProvider {

    readonly identifier = IntegrationProviderIdentifier.WHATSAPP;
    readonly name = 'WhatsApp';
    readonly description = 'Connect your WhatsApp to capture memos and get notifications';

    private config;

    constructor() {
        // Validate config on initialization
        if (!config.WHATSAPP_API_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID || !config.WHATSAPP_VERIFY_TOKEN) {
            throw new Error('WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN are required');
        }

        this.config = {
            apiToken: config.WHATSAPP_API_TOKEN,
            phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
            verifyToken: config.WHATSAPP_VERIFY_TOKEN,
        };
    }

    private getApiUrl(phoneNumberId?: string) {
        const id = phoneNumberId || this.config.phoneNumberId;
        return `https://graph.facebook.com/v21.0/${id}`;
    }

    // Handles incoming WhatsApp webhook events
    async handleWebhook(data: WhatsAppWebhookPayload): Promise<void> {
        const entry = data.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const recipientPhoneNumberId = value?.metadata?.phone_number_id;

        // 1. Handle Status Updates (sent, delivered, read, etc)
        if (value?.statuses && value.statuses.length > 0) {
            const status = value.statuses[0];
            logger.info('WhatsApp Status Update', { id: status.id, status: status.status, recipient: status.recipient_id });

            // Update the notification status in DB using the WhatsApp message ID
            await Notification.findOneAndUpdate(
                { whatsappId: status.id },
                { $set: { whatsappStatus: status.status } }
            );
            return;
        }

        // 2. Handle Incoming Messages
        const message = value?.messages?.[0];
        if (!message) return;

        const from = message.from;
        logger.info('WhatsApp Webhook message', { from, type: message.type });

        // 1. Priority check: Is this a verification/linking command?
        if (message.type === 'text' && message.text?.body.toLowerCase().startsWith('verify')) {
            const body = message.text.body;
            const code = body.replace(/verify:?/i, '').trim();
            logger.info('Attempting WhatsApp link with code', { code, from });

            const userByCode = await User.findOne({
                whatsappLinkingCode: code,
                whatsappLinkingCodeExpires: { $gt: new Date() }
            });

            if (!userByCode) {
                logger.warn('Linking code not found or expired', { code, from });
                await this.sendMessage(from, `❌ Invalid or expired verification code. Please generate a new one in your settings.`, recipientPhoneNumberId);
                return;
            }

            // Check if THIS NUMBER is already linked to ANY user
            const alreadyLinkedUser = await User.findOne({ whatsappNumber: from });
            if (alreadyLinkedUser) {
                if (alreadyLinkedUser._id.toString() === userByCode._id.toString()) {
                    await this.sendMessage(from, `✅ Your account is already linked to this WhatsApp number.`, recipientPhoneNumberId);
                } else {
                    logger.warn('WhatsApp number already linked to another user', { from, existingUser: alreadyLinkedUser.email });
                    await this.sendMessage(from, `❌ This WhatsApp number is already linked to another Brinn account (${alreadyLinkedUser.email}). Please disconnect it from that account first.`, recipientPhoneNumberId);
                }
                return;
            }

            // Perform linking
            userByCode.whatsappNumber = from;
            userByCode.whatsappLinkingCode = undefined;
            userByCode.whatsappLinkingCodeExpires = undefined;
            await userByCode.save();

            await cacheService.del(CacheKeys.userProfile(userByCode._id.toString()));
            socketService.emitToUser(userByCode._id, SocketEvents.INTEGRATION_WHATSAPP_LINKED, { whatsappNumber: from, email: userByCode.email });

            await this.sendMessage(from, `✅ Success! Your WhatsApp number is now linked to ${userByCode.email}. You can now send text or voice notes to capture memos.`, recipientPhoneNumberId);
            return;
        }

        // 2. Regular Message Processing (Find user by number)
        const user = await User.findOne({ whatsappNumber: from });

        if (!user) {
            logger.warn('WhatsApp message from unlinked number', { from });
            await this.sendMessage(from, "Your phone number is not linked to any Brinn account. Please link it in your settings.", recipientPhoneNumberId);
            return;
        }

        try {
            if (message.type === 'text' && message.text) {
                await this.handleTextMessage(user._id.toString(), from, message.text.body, recipientPhoneNumberId);
            } else if (message.type === 'audio' && message.audio) {
                await this.handleAudioMessage(user._id.toString(), from, message.audio.id, message.audio.mime_type, recipientPhoneNumberId);
            } else if (message.type === 'image' && message.image) {
                await this.handleImageMessage(user._id.toString(), from, message.image.id, message.image.mime_type, recipientPhoneNumberId);
            } else if (message.type === 'document' && message.document) {
                await this.handleDocumentMessage(user._id.toString(), from, message.document.id, message.document.mime_type, recipientPhoneNumberId);
            } else if (message.type === 'video' && message.video) {
                await this.handleVideoMessage(user._id.toString(), from, message.video.id, message.video.mime_type, recipientPhoneNumberId);
            } else {
                logger.debug('Unsupported WhatsApp message type', { type: message.type, from });
            }
        } catch (error) {
            logger.error('Error processing WhatsApp message', { error, from, userId: user._id });
            await this.sendMessage(from, "I'm sorry, I encountered an error processing your message.", recipientPhoneNumberId);
        }
    }

    private async handleTextMessage(userId: string, from: string, text: string, recipientPhoneNumberId?: string) {
        const entry = await captureService.captureWhatsApp(userId, {
            from,
            body: text,
            isVoice: false,
            timestamp: new Date()
        });

        // 2. Respond via Receptionist (Dynamic acknowledgment)
        const response = await receptionService.generateResponse(userId, entry);
        if (response) {
            await this.sendMessage(from, response, recipientPhoneNumberId);
        }
    }

    private async handleAudioMessage(userId: string, from: string, mediaId: string, mimeType: string, recipientPhoneNumberId?: string) {
        logger.info('Offloading WhatsApp audio to media queue', { mediaId, userId });
        addMediaJob({
            mediaId: '', 
            userId,
            jobType: MediaJobType.PROCESS_AUDIO,
            sourceType: MediaSource.WHATSAPP,
            whatsappData: { from, mediaId, mimeType }
        });
    }

    private async handleImageMessage(userId: string, from: string, mediaId: string, mimeType: string, recipientPhoneNumberId?: string) {
        logger.info('Offloading WhatsApp image to media queue', { mediaId, userId });
        addMediaJob({
            mediaId: '',
            userId,
            jobType: MediaJobType.PROCESS_IMAGE,
            sourceType: MediaSource.WHATSAPP,
            whatsappData: { from, mediaId, mimeType }
        });
    }

    private async handleDocumentMessage(userId: string, from: string, mediaId: string, mimeType: string, recipientPhoneNumberId?: string) {
        logger.info('Offloading WhatsApp document to media queue', { mediaId, userId });
        addMediaJob({
            mediaId: '',
            userId,
            jobType: MediaJobType.PROCESS_DOCUMENT,
            sourceType: MediaSource.WHATSAPP,
            whatsappData: { from, mediaId, mimeType }
        });
    }

    private async handleVideoMessage(userId: string, from: string, mediaId: string, mimeType: string, recipientPhoneNumberId?: string) {
        logger.info('Offloading WhatsApp video to media queue', { mediaId, userId });
        addMediaJob({
            mediaId: '',
            userId,
            jobType: MediaJobType.PROCESS_VIDEO,
            sourceType: MediaSource.WHATSAPP,
            whatsappData: { from, mediaId, mimeType }
        });
    }

    // Downloads media from WhatsApp Cloud API
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

    // Sends a text message back to WhatsApp user
    async sendMessage(to: string, text: string, fromId?: string): Promise<string | undefined> {
        try {
            const url = this.getApiUrl(fromId);
            const response = await axios.post(
                `${url}/messages`,
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

            const messageId = response.data.messages?.[0]?.id;
            logger.info('WhatsApp message sent', { to, messageId, fromId: fromId || this.config.phoneNumberId });
            return messageId;

        } catch (error: any) {
            logger.error('Failed to send WhatsApp message', {
                error: error.response?.data || error.message,
                to,
                fromId: fromId || this.config.phoneNumberId
            });
            return undefined;
        }
    }

    // Webhook verification (GET request from Meta)
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

    // IIntegrationProvider Methods
    async getAuthUrl(userId: string): Promise<{ url: string;[key: string]: any }> {
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await User.findByIdAndUpdate(userId, {
            whatsappLinkingCode: code,
            whatsappLinkingCodeExpires: expiresAt
        });

        const phoneNumber = config.WHATSAPP_DISPLAY_NUMBER.replace(/\D/g, ''); // remove everything thats not a number/digit
        const link = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=Verify%20${code}`;
        logger.info('Generated WhatsApp link via getAuthUrl', { link, userId });

        return { url: link };
    }

    async handleCallback(_code: string, _userId: string): Promise<IIntegrationTokenDocument> {
        throw new Error('WhatsApp does not support OAuth callback flow');
    }

    async verifyConnection(userId: string): Promise<boolean> {
        const user = await User.findById(userId);
        return !!user?.whatsappNumber;
    }

    async disconnect(userId: string): Promise<void> {
        await User.findByIdAndUpdate(userId, {
            $unset: {
                whatsappNumber: 1,
                whatsappLinkingCode: 1,
                whatsappLinkingCodeExpires: 1
            }
        });

        // Invalidate profile cache
        await cacheService.del(CacheKeys.userProfile(userId.toString()));
    }
}

export const whatsappProvider = new WhatsAppProvider();


