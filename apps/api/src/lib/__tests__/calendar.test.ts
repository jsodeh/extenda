import { it } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleCalendarAdapter } from '../../adapters/google-calendar.js';
import { groundedAnswers } from '../../tools/form-answers.js';
import { oauth } from '../../routes/oauth.js';

it('passes the reviewed calendar, times, recurrence, invitations and reminder to Google', async () => {
    let conflict = true;
    const writes: any[] = [];
    const client = {
        calendars: { get: async () => ({ data: { id: 'work' } }) },
        freebusy: {
            query: async ({ requestBody }: any) => {
                assert.deepEqual(requestBody.items, [{ id: 'work' }]);
                return { data: { calendars: { work: { busy: conflict ? [{}] : [] } } } };
            }
        },
        events: {
            get: async ({ eventId }: any) => ({ data: { id: eventId } }),
            insert: async (request: any) => {
                writes.push(request);
                return { data: { id: 'fixture' } };
            }
        }
    };
    const calendar = new GoogleCalendarAdapter(() => client as any);
    const params = {
        summary: 'Planning',
        start: '2030-01-07T09:00:00+01:00',
        end: '2030-01-07T11:00:00+01:00',
        timezone: 'Africa/Lagos',
        calendarId: 'work',
        reminderMinutes: 15,
        attendees: ['invitee@example.test'],
        recurrence: ['RRULE:FREQ=WEEKLY;COUNT=2']
    };
    assert.equal(
        (await calendar.execute('get_event', { calendarId: 'work', eventId: 'fixture' }, {})).id,
        'fixture'
    );
    await assert.rejects(calendar.execute('create_event', params, {}), /conflict/);
    assert.equal(writes.length, 0);
    conflict = false;
    const reviewed = await calendar.prepareChange('create_event', { ...params, calendarId: 'primary' }, {});
    assert.equal(reviewed.calendarId, 'work');
    await calendar.execute('create_event', reviewed, { idempotencyKey: 'test-event' });
    assert.equal(writes[0].calendarId, 'work');
    assert.equal(writes[0].sendUpdates, 'all');
    assert.equal(writes[0].requestBody.start.timeZone, 'Africa/Lagos');
    assert.deepEqual(writes[0].requestBody.attendees, [{ email: 'invitee@example.test' }]);
    assert.deepEqual(writes[0].requestBody.recurrence, params.recurrence);
    assert.equal(writes[0].requestBody.reminders.overrides[0].minutes, 15);
});
it('keeps unsupported qualifications and unknown required answers out of a form', () => {
    const fields = ['Education', 'Employer', 'Certification'].map((label) => ({
        selector: '#' + label,
        label,
        required: true,
        type: 'text'
    }));
    const result = groundedAnswers(
        fields,
        ['[fixture CV] BSc. Worked at Example Co.'],
        [
            { selector: '#Education', value: 'PhD', quote: 'BSc', source: 0, kind: 'narrative' },
            { selector: '#Certification', value: 'PMP', quote: 'PMP', source: 0, kind: 'fact' },
            { selector: '#Employer', value: 'Example Co', quote: 'Worked at Example Co.', source: 0, kind: 'fact' }
        ]
    );
    assert.deepEqual({ ...result.formData }, { '#Employer': 'Example Co' });
    assert.deepEqual(result.missing, ['Education', 'Certification']);
});
it('rejects a provider callback with mismatched state before contacting the provider', async () => {
    const res = await oauth.request('/callback/linkedin?state=invalid&code=fixture', {
        headers: { Cookie: 'oauth_link=expected' }
    });
    assert.equal(res.status, 400);
});
