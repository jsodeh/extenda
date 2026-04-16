import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_event',
        name: 'create_event',
        description: 'Create a calendar event',
        parameters: {
            type: 'object',
            required: ['summary', 'start', 'end'],
            properties: {
                summary: { type: 'string', description: 'Event title' },
                description: { type: 'string', description: 'Event description' },
                start: { type: 'string', description: 'Start time (ISO 8601)' },
                end: { type: 'string', description: 'End time (ISO 8601)' },
                attendees: { type: 'array', items: { type: 'string' }, description: 'Email addresses of attendees' }
            }
        }
    },
    {
        id: 'list_events',
        name: 'list_events',
        description: 'List upcoming calendar events',
        parameters: {
            type: 'object',
            properties: {
                timeMin: { type: 'string', description: 'Start time filter (ISO 8601)' },
                maxResults: { type: 'number', description: 'Max events to return' }
            }
        }
    }
];

export class GoogleCalendarAdapter extends BaseAdapter {
    id = 'google_calendar';
    type = 'oauth' as const;
    provider = 'google';
    name = 'GoogleCalendarAdapter';
    description = 'Manage Google Calendar events';
    version = '1.0.0';
    scopes = ['https://www.googleapis.com/auth/calendar'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        }

        const calendar = google.calendar({ version: 'v3', auth });

        switch (actionName) {
            case 'create_event':
                const event = {
                    summary: params.summary,
                    description: params.description,
                    start: { dateTime: params.start },
                    end: { dateTime: params.end },
                    attendees: params.attendees?.map((email: string) => ({ email }))
                };
                const result = await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: event,
                    sendUpdates: 'all' // Send invite emails to attendees
                });
                return {
                    eventId: result.data.id,
                    htmlLink: result.data.htmlLink,
                    summary: result.data.summary,
                    start: result.data.start,
                    end: result.data.end,
                    attendees: result.data.attendees
                };

            case 'list_events':
                const res = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: params.timeMin || new Date().toISOString(),
                    maxResults: params.maxResults || 10,
                    singleEvents: true,
                    orderBy: 'startTime'
                });
                return res.data.items;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
