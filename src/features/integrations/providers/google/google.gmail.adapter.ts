import { google } from 'googleapis';
import { logger } from '../../../../config/logger';

export interface EmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    subject: string;
    from: string;
    to: string;
    date: Date;
    bodyPlainText?: string;
}

export class GoogleGmailAdapter {
    /**
     * Get recent emails for a user
     */
    static async getRecentEmails(auth: any, maxResults = 10, query = ''): Promise<EmailMessage[]> {
        try {
            const gmail = google.gmail({ version: 'v1', auth });

            // Fetch list of message IDs
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q: query,
            });

            const messages = listResponse.data.messages || [];

            if (messages.length === 0) {
                return [];
            }

            // Fetch full message details for each ID
            const emailPromises = messages.map(async (msg) => {
                const msgDetails = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id!,
                    format: 'full',
                });

                const payload = msgDetails.data.payload;
                const headers = payload?.headers || [];

                const subjectInfo = headers.find((header) => header.name === 'Subject');
                const fromInfo = headers.find((header) => header.name === 'From');
                const toInfo = headers.find((header) => header.name === 'To');
                const dateInfo = headers.find((header) => header.name === 'Date');

                let bodyPlainText = '';

                // Helper to extract plain text body
                const extractPlainText = (parts: any[]) => {
                    for (const part of parts) {
                        if (part.mimeType === 'text/plain' && part.body?.data) {
                            bodyPlainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
                        } else if (part.parts) {
                            extractPlainText(part.parts);
                        }
                    }
                };

                if (payload?.mimeType === 'text/plain' && payload.body?.data) {
                    bodyPlainText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                } else if (payload?.parts) {
                    extractPlainText(payload.parts);
                }

                return {
                    id: msgDetails.data.id!,
                    threadId: msgDetails.data.threadId!,
                    snippet: msgDetails.data.snippet || '',
                    subject: subjectInfo?.value || '(No Subject)',
                    from: fromInfo?.value || 'UnknownSender',
                    to: toInfo?.value || 'UnknownRecipient',
                    date: new Date(dateInfo?.value || Date.now()),
                    bodyPlainText: bodyPlainText.slice(0, 1000), // Trim to avoid massive token usage
                };
            });

            return await Promise.all(emailPromises);
        } catch (error) {
            logger.error(`Failed to get recent emails`, error);
            throw new Error('Failed to fetch recent emails');
        }
    }

    /**
     * Send an email
     */
    static async sendEmail(auth: any, to: string, subject: string, bodyText: string): Promise<string> {
        try {
            const gmail = google.gmail({ version: 'v1', auth });

            // Construct MIME message
            const str = [
                `To: ${to}`,
                `Subject: ${subject}`,
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=utf-8',
                '',
                bodyText,
            ].join('\n');

            const encodedEmail = Buffer.from(str)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail,
                },
            });

            return response.data.id || 'unknown_id';
        } catch (error) {
            logger.error(`Failed to send email`, error);
            throw new Error('Failed to send email');
        }
    }
}
