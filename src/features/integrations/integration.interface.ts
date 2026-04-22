import { IIntegrationTokenDocument } from './integration.model';

export enum IntegrationProviderIdentifier {
    GOOGLE_CALENDAR = 'google_calendar',
    GOOGLE_GMAIL = 'google_gmail',
    WHATSAPP = 'whatsapp'
}

export interface IIntegrationProvider {
    readonly identifier: IntegrationProviderIdentifier; // e.g. 'google_calendar', 'google_gmail'
    readonly name: string; // e.g. 'Google Calendar'
    readonly description: string; // e.g. 'Read and create events'
    
    // Returns the connection URL (OAuth or direct link)
    getAuthUrl(userId: string): string | Promise<string>;
    
    // Processes the returning OAuth code & saves credentials for this provider
    handleCallback(code: string, userId: string): Promise<IIntegrationTokenDocument>;
    
    // Validates a user currently has a valid existing connection
    verifyConnection(userId: string): Promise<boolean>;

    // Disconnects the provider and cleans up credentials
    disconnect(userId: string): Promise<void>;
}

