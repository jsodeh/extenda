export function validTimezone(value: unknown): string {
    if (typeof value !== 'string' || !value || value.length > 100) throw new Error('Choose an IANA timezone');
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return value;
}

export function instant(value: unknown) {
    if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/i.test(value) || !Number.isFinite(Date.parse(value)))
        throw new Error('Provide a timestamp with a UTC offset');
    return new Date(value);
}

export function timeRange(start: unknown, end: unknown) {
    const from = instant(start),
        to = instant(end);
    if (from >= to) throw new Error('End time must follow start time');
    return { timeMin: from.toISOString(), timeMax: to.toISOString() };
}

// Check every supported occurrence before handing the recurrence to Google.
export function calendarSlots(start: string, end: string, zone: string, recurrence?: string[]) {
    const first = timeRange(start, end);
    if (!recurrence?.length) return [first];
    const unsupported = () => new Error('Use a finite daily or weekly RRULE within one year, or review this series in Google Calendar');
    if (!Array.isArray(recurrence) || recurrence.length !== 1 || !recurrence[0].startsWith('RRULE:')) throw unsupported();
    const rule = new Map<string, string>();
    for (const entry of recurrence[0].slice(6).split(';')) {
        const match = /^(FREQ|COUNT|INTERVAL)=(DAILY|WEEKLY|[1-9]\d*)$/.exec(entry);
        if (!match || rule.has(match[1])) throw unsupported();
        rule.set(match[1], match[2]);
    }
    const count = Number(rule.get('COUNT')), interval = Number(rule.get('INTERVAL') || 1);
    const days = rule.get('FREQ') === 'DAILY' ? 1 : rule.get('FREQ') === 'WEEKLY' ? 7 : 0;
    if (!days || !Number.isSafeInteger(count) || count < 1 || count > 366 || !Number.isSafeInteger(interval) ||
        interval < 1 || (count - 1) * interval * days > 365) throw unsupported();
    const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, hourCycle: 'h23', year: 'numeric',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const wall = (ms: number) => {
        const p = Object.fromEntries(formatter.formatToParts(ms).map(part => [part.type, part.value]));
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second, new Date(ms).getUTCMilliseconds());
    };
    const day = 86400000;
    const atLocalTime = (target: number) => {
        const offsets = new Set([target - day, target, target + day].map(t => wall(t) - t));
        const times = [...offsets].map(offset => target - offset).filter(t => wall(t) === target);
        if (times.length !== 1) throw new Error('Review this daylight-saving transition in Google Calendar');
        return new Date(times[0]).toISOString();
    };
    const firstStart = Date.parse(first.timeMin), duration = Date.parse(first.timeMax) - firstStart;
    return Array.from({length: count}, (_, index) => {
        if (!index) return first;
        const timeMin = atLocalTime(wall(firstStart) + index * interval * days * day);
        return { timeMin, timeMax: new Date(Date.parse(timeMin) + duration).toISOString() };
    });
}
