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
                assert.equal(requestBody.timeMax, '2030-01-14T10:00:00.000Z');
                assert.deepEqual(requestBody.items, [{ id: 'work' }]);
                return { data: { calendars: { work: { busy: conflict ? [{start:'2030-01-14T08:30:00Z',end:'2030-01-14T09:00:00Z'}] : [{start:'2030-01-08T08:00:00Z',end:'2030-01-08T10:00:00Z'}] } } } };
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

it('leaves unsupported, negated, expired, conflicting and third-party professional claims blank', () => {
    const cases = [
        ['Certification','PMP','Certifications: PMP. I never completed PMP.'],
        ['Certification','PMP','Certifications: PMP (expired 2023).'],
        ['Certification','PMP','Certifications: PMP. Expired in 2023.'],
        ['Education','MSc','Name: Another Person. Education: MSc.'],
        ['Certification','PMP','Reference: Ada. Certifications: PMP.'],
        ['Education','MSc','Education: MSc','Education: BSc'],
        ['Employment start date','2020','Employment dates: 2019 or 2020'],
        ['Employer','Example Co','My colleague worked at Example Co.'],
        ['Professional achievements','Led the project','Achievements: Contributed to the project.'],
        ['Professional achievements','Example launch','Projects: Example launch.'],
        ['Contact email','1234','Phone: 1234.'],
        ['Employment start date','2026-02-30','Employment start date: 2026-02-30.'],
        ['Motivation','I led the team','Projects: Helped with testing.']
    ];
    for (const [label,value,...docs] of cases) {
        const result=groundedAnswers([{label,type:'text',selector:'#f',required:true}],docs.map(d=>'[CV] '+d),
            [{selector:'#f',source:0,value,quote:docs[0].includes(value) ? value : docs[0],kind:'fact'}]);
        assert.deepEqual(result.missing,[label],docs.join(' / '));
    }
    const date=groundedAnswers([{label:'Employment start date',type:'date',selector:'#f',required:true}],
        ['[CV] Employment start date: 2020-01-06'],[{selector:'#f',source:0,value:'2020-01-06',quote:'2020-01-06',kind:'fact'}]);
    assert.equal(date.formData['#f'],'2020-01-06');
});
