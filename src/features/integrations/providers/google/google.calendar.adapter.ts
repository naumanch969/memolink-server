import { google } from 'googleapis';
import { logger } from '../../../../config/logger';

export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees: Array<{ email: string; name?: string; responseStatus?: string }>;
    htmlLink: string;
}

export class GoogleCalendarAdapter {
    /**
     * Get events for a user between two dates
     */
    static async getEvents(auth: any, timeMin: Date, timeMax: Date, maxResults = 50): Promise<CalendarEvent[]> {
        try {
            const calendar = google.calendar({ version: 'v3', auth });

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items || [];

            return events.map((event) => ({
                id: event.id!,
                summary: event.summary || 'Untitled Event',
                description: event.description || undefined,
                start: event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date || ''),
                end: event.end?.dateTime ? new Date(event.end.dateTime) : new Date(event.end?.date || ''),
                location: event.location || undefined,
                attendees: (event.attendees || []).map((attendee) => ({
                    email: attendee.email!,
                    name: attendee.displayName || undefined,
                    responseStatus: attendee.responseStatus || undefined,
                })),
                htmlLink: event.htmlLink!,
            }));
        } catch (error) {
            logger.error(`Failed to get calendar events`, error);
            throw new Error('Failed to fetch calendar events');
        }
    }

    /**
     * Create a new calendar event
     */
    static async createEvent(
        auth: any,
        summary: string,
        start: Date,
        end: Date,
        description?: string,
        location?: string,
        attendees?: string[]
    ): Promise<CalendarEvent> {
        try {
            const calendar = google.calendar({ version: 'v3', auth });

            const eventData = {
                summary,
                description,
                location,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
                attendees: attendees?.map((email) => ({ email })),
            };

            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventData,
            });

            const event = response.data;

            return {
                id: event.id!,
                summary: event.summary || 'Untitled Event',
                description: event.description || undefined,
                start: event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date || ''),
                end: event.end?.dateTime ? new Date(event.end.dateTime) : new Date(event.end?.date || ''),
                location: event.location || undefined,
                attendees: (event.attendees || []).map((attendee) => ({
                    email: attendee.email!,
                    name: attendee.displayName || undefined,
                    responseStatus: attendee.responseStatus || undefined,
                })),
                htmlLink: event.htmlLink!,
            };
        } catch (error) {
            logger.error(`Failed to create calendar event`, error);
            throw new Error('Failed to create calendar event');
        }
    }
}
