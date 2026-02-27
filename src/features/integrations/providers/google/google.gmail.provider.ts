import { BaseGoogleProvider } from "./base.google.provider";

export class GoogleGmailProvider extends BaseGoogleProvider {
    readonly identifier = 'google_gmail';
    readonly name = 'Google Gmail';
    readonly description = 'Read and send emails';
    readonly scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
    ];
}

export const googleGmailProvider = new GoogleGmailProvider();
