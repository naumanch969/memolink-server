import { body, query } from 'express-validator';

/**
 * Validations for WhatsApp Webhook payload
 * Note: These are for middleware use or manual check
 */
export const whatsappWebhookValidation = [
    body('object').equals('whatsapp_business_account'),
    body('entry').isArray().notEmpty(),
    body('entry.*.changes').isArray().notEmpty(),
    body('entry.*.changes.*.field').equals('messages'),
    body('entry.*.changes.*.value.messaging_product').equals('whatsapp'),
];

export const whatsappVerifyValidation = [
    query('hub.mode').equals('subscribe'),
    query('hub.verify_token').notEmpty(),
    query('hub.challenge').notEmpty(),
];
