import { Types } from "mongoose";
import { GoogleGmailAdapter } from "../providers/google/google.gmail.adapter";
import { googleGmailProvider } from "../providers/google/google.gmail.provider";
import { AgentTool } from "./tool.interface";

export class GetRecentEmailsTool extends AgentTool {
    readonly name = "get_recent_emails";
    readonly description = "Retrieve recent emails from the user's Gmail using optional search queries (e.g. 'is:unread', 'from:boss@company.com').";
    readonly requiredIntegration = "google_gmail";
    readonly parameters = {
        type: "object",
        properties: {
            limit: {
                type: "number",
                description: "Number of emails to retrieve (default is 10, max 20)."
            },
            query: {
                type: "string",
                description: "Gmail advanced search query to filter results (e.g. 'is:unread', 'has:attachment', 'from:steve'). Empty means fetch all."
            }
        }
    };

    async execute(args: any, userId: string | Types.ObjectId): Promise<any> {
        const limit = args.limit || 10;
        const query = args.query || '';
        const authClient = await googleGmailProvider.getClient(userId.toString());

        const emails = await GoogleGmailAdapter.getRecentEmails(authClient, limit, query);

        return emails.map(e => ({
            id: e.id,
            subject: e.subject,
            from: e.from,
            to: e.to,
            date: e.date.toISOString(),
            snippet: e.snippet,
            bodyPlainText: e.bodyPlainText
        }));
    }
}

export class SendEmailTool extends AgentTool {
    readonly name = "send_email";
    readonly description = "Send an email beautifully via the user's attached Gmail account.";
    readonly requiredIntegration = "google_gmail";
    readonly parameters = {
        type: "object",
        properties: {
            to: {
                type: "string",
                description: "The recipient's email address."
            },
            subject: {
                type: "string",
                description: "The subject line of the email."
            },
            bodyText: {
                type: "string",
                description: "The raw text content of the email."
            }
        },
        required: ["to", "subject", "bodyText"]
    };

    async execute(args: any, userId: string | Types.ObjectId): Promise<any> {
        const { to, subject, bodyText } = args;
        const authClient = await googleGmailProvider.getClient(userId.toString());

        const messageId = await GoogleGmailAdapter.sendEmail(authClient, to, subject, bodyText);

        return {
            status: "sent",
            recipient: to,
            messageId
        };
    }
}
