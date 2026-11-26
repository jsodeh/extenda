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
