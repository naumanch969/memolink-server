import { IIntegrationTokenDocument } from './integration.model';

export interface IIntegrationProvider {
    readonly identifier: string; // e.g. 'google_calendar', 'google_gmail'
    readonly name: string; // e.g. 'Google Calendar'
    readonly description: string; // e.g. 'Read and create events'
    
    // Returns the OAuth connection URL
    getAuthUrl(userId: string): string;
    
    // Processes the returning OAuth code & saves credentials for this provider
    handleCallback(code: string, userId: string): Promise<IIntegrationTokenDocument>;
    
    // Validates a user currently has a valid existing connection
    verifyConnection(userId: string): Promise<boolean>;
}
