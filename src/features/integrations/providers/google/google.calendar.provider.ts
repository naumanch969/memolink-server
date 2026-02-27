import { BaseGoogleProvider } from "./base.google.provider";

export class GoogleCalendarProvider extends BaseGoogleProvider {
    readonly identifier = 'google_calendar';
    readonly name = 'Google Calendar';
    readonly description = 'Read and manage your calendar events';
    readonly scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
    ];
}

export const googleCalendarProvider = new GoogleCalendarProvider();
