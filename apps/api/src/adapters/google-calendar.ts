import { createHash } from 'node:crypto';
import { validTimezone,timeRange } from '../lib/scheduling.js';
import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const scheduleFields = {
    timezone:{type:'string',description:'IANA timezone'},calendarId:{type:'string',description:'Defaults to primary'},
    recurrence:{type:'array',items:{type:'string'},description:'Google Calendar RRULE lines'},
    reminderMinutes:{type:'number',description:'Popup minutes before event'}
};
const ACTIONS: AdapterAction[] = [
    {id:'free_busy',name:'free_busy',description:'Check calendar availability in a time range',
        parameters:{type:'object',required:['start','end'],properties:{...scheduleFields,start:{type:'string'},end:{type:'string'}}}},
    {
        id: 'create_event',
        name: 'create_event',
        description: 'Create a calendar event',
        parameters: {
            type: 'object',
            required: ['summary', 'start', 'end'],
            properties: {
                ...scheduleFields,
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
    },
    {
        id: 'delete_event',
        name: 'delete_event',
        description: 'Delete a calendar event',
        parameters: {
            type: 'object',
            required: ['eventId'],
            properties: {
                eventId: { type: 'string', description: 'ID of the event to delete' },
                calendarId: { type: 'string', description: 'Calendar ID (default: primary)' }
            }
        }
    },
    {
        id: 'update_event',
        name: 'update_event',
        description: 'Update an existing calendar event',
        parameters: {
            type: 'object',
            required: ['eventId'],
            properties: {
                eventId: { type: 'string', description: 'ID of the event to update' },
                ...scheduleFields,
                summary: { type: 'string', description: 'New title' },
                description: { type: 'string', description: 'New description' },
                start: { type: 'string', description: 'New start time (ISO 8601)' },
                end: { type: 'string', description: 'New end time (ISO 8601)' }
            }
        }
    },
    {
        id: 'get_event',
        name: 'get_event',
        description: 'Get details of a specific calendar event',
        parameters: {
            type: 'object',
            required: ['eventId'],
            properties: {
                eventId: { type: 'string', description: 'Event ID' }
            }
        }
    },
    {
        id: 'list_calendars',
        name: 'list_calendars',
        description: 'List all calendars the user has access to',
        parameters: {
            type: 'object',
            properties: {}
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
            process.env.GOOGLE_AUTH_CLIENT_SECRET,
            process.env.GOOGLE_AUTH_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        }

        const calendar = google.calendar({ version: 'v3', auth });

        const calendarId=params.calendarId || 'primary';
        const timeZone=validTimezone(params.timezone || 'UTC');
        const busy = async () => {
            const range=timeRange(params.start,params.end);
            const response=await calendar.freebusy.query({requestBody:{...range,timeZone,items:[{id:calendarId}]}});
            const result=response.data.calendars?.[calendarId];
            if (!result || result.errors?.length) throw new Error('Availability could not be verified');
            return result.busy || [];
        };
        const reminders=params.reminderMinutes === undefined ? undefined : {useDefault:false,overrides:[{method:'popup',minutes:params.reminderMinutes}]};
        switch (actionName) {
            case 'free_busy': return {calendarId,timeZone,busy:await busy()};
            case 'create_event':
                if ((await busy()).length) throw new Error('Calendar conflict. Choose another time.');
                const event = {
                    id:context.idempotencyKey ? createHash('sha256').update(context.idempotencyKey).digest('hex') : undefined,
                    recurrence:params.recurrence, reminders,
                    summary: params.summary,
                    description: params.description,
                    start: { dateTime: params.start, timeZone },
                    end: { dateTime: params.end, timeZone },
                    attendees: params.attendees?.map((email: string) => ({ email }))
                };
                const result = await calendar.events.insert({
                    calendarId,
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
                    calendarId,
                    timeMin: params.timeMin || new Date().toISOString(),
                    maxResults: params.maxResults || 10,
                    singleEvents: true,
                    orderBy: 'startTime'
                });
                return res.data.items;

            case 'delete_event':
                await calendar.events.delete({
                    calendarId: params.calendarId || 'primary',
                    eventId: params.eventId
                });
                return { success: true, message: `Event ${params.eventId} deleted` };

            case 'update_event':
                if (params.start || params.end) {
                    const current=await calendar.events.get({calendarId,eventId:params.eventId});
                    const range=timeRange(params.start || current.data.start?.dateTime,params.end || current.data.end?.dateTime);
                    const overlaps=await calendar.events.list({calendarId,...range,singleEvents:true});
                    if (overlaps.data.nextPageToken || overlaps.data.items?.some(e=>e.id!==params.eventId && e.transparency!=='transparent' && e.status!=='cancelled')) throw new Error('Calendar conflict');
                }
                const updateRes = await calendar.events.patch({
                    calendarId,
                    eventId: params.eventId,
                    sendUpdates:'all',
                    requestBody: {
                        recurrence:params.recurrence,reminders,attendees:params.attendees?.map((email:string)=>({email})),
                        summary: params.summary,
                        description: params.description,
                        start: params.start ? { dateTime: params.start, timeZone } : undefined,
                        end: params.end ? { dateTime: params.end, timeZone } : undefined
                    }
                });
                return updateRes.data;

            case 'get_event':
                const getRes = await calendar.events.get({
                    calendarId,
                    eventId: params.eventId || params.id
                });
                return getRes.data;

            case 'list_calendars':
                const calendarsRes = await calendar.calendarList.list();
                return calendarsRes.data.items;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
