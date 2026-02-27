import { Types } from "mongoose";
import { GoogleCalendarAdapter } from "../providers/google/google.calendar.adapter";
import { googleCalendarProvider } from "../providers/google/google.calendar.provider";
import { AgentTool } from "./tool.interface";

export class GetCalendarEventsTool extends AgentTool {
    readonly name = "get_calendar_events";
    readonly description = "Get the user's Google Calendar events for a specific time range. Input dates must be ISO 8601 strings.";
    readonly requiredIntegration = "google_calendar";
    readonly parameters = {
        type: "object",
        properties: {
            timeMin: {
                type: "string",
                description: "ISO datetime string for the start of the time range (e.g. 2026-02-27T00:00:00Z)"
            },
            timeMax: {
                type: "string",
                description: "ISO datetime string for the end of the time range (e.g. 2026-02-28T00:00:00Z)"
            }
        },
        required: ["timeMin", "timeMax"]
    };

    async execute(args: any, userId: string | Types.ObjectId): Promise<any> {
        const { timeMin, timeMax } = args;
        const authClient = await googleCalendarProvider.getClient(userId.toString());

        const events = await GoogleCalendarAdapter.getEvents(
            authClient,
            new Date(timeMin),
            new Date(timeMax)
        );

        // Simplify for LLM digestion
        return events.map(e => ({
            id: e.id,
            summary: e.summary,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
            location: e.location,
            attendees: e.attendees.map(a => a.name || a.email)
        }));
    }
}

export class CreateCalendarEventTool extends AgentTool {
    readonly name = "create_calendar_event";
    readonly description = "Create a new event on the user's Google Calendar";
    readonly requiredIntegration = "google_calendar";
    readonly parameters = {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "The title of the event"
            },
            start: {
                type: "string",
                description: "ISO datetime string for the start of the event"
            },
            end: {
                type: "string",
                description: "ISO datetime string for the end of the event"
            },
            description: {
                type: "string",
                description: "Optional details about the event"
            },
            location: {
                type: "string",
                description: "Optional location"
            }
        },
        required: ["summary", "start", "end"]
    };

    async execute(args: any, userId: string | Types.ObjectId): Promise<any> {
        const { summary, start, end, description, location } = args;
        const authClient = await googleCalendarProvider.getClient(userId.toString());

        const event = await GoogleCalendarAdapter.createEvent(
            authClient,
            summary,
            new Date(start),
            new Date(end),
            description,
            location
        );

        return {
            id: event.id,
            summary: event.summary,
            htmlLink: event.htmlLink,
            status: "created"
        };
    }
}
