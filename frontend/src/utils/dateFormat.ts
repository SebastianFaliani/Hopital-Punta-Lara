export function toDateInputValue(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  return String(value)
    .slice(0, 10);
}

export function formatDisplayDate(
  value?: string | null,
  fallback = '-'
) {
  const input =
    toDateInputValue(value);

  if (!input) {
    return fallback;
  }

  const [
    year,
    month,
    day
  ] =
    input.split('-');

  if (!year || !month || !day) {
    return input;
  }

  return `${day}-${month}-${year}`;
}

export function formatDisplayDateTime(
  value?: string | null,
  fallback = '-'
) {
  if (!value) {
    return fallback;
  }

  const input =
    String(value);

  const hasTimezone =
    /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);

  if (hasTimezone) {
    const parsed =
      new Date(input);

    if (!Number.isNaN(parsed.getTime())) {
      const parts =
        new Intl.DateTimeFormat(
          'es-AR',
          {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }
        ).formatToParts(parsed);

      const part =
        (type: Intl.DateTimeFormatPartTypes) =>
          parts.find((item) => item.type === type)?.value || '';

      return `${part('day')}-${part('month')}-${part('year')} ${part('hour')}:${part('minute')}`;
    }
  }

  const normalized =
    String(value)
      .replace('T', ' ');

  const date =
    formatDisplayDate(
      normalized.slice(0, 10),
      ''
    );

  const time =
    normalized.slice(11, 16);

  return date
    ? `${date}${time ? ` ${time}` : ''}`
    : normalized;
}
