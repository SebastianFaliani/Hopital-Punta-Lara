export function toDateInputValue(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  return String(value)
    .slice(0, 10);
}

const applicationTimeZone =
  'America/Argentina/Buenos_Aires';

function getZonedPart(
  date: Date,
  type: Intl.DateTimeFormatPartTypes
) {
  const parts =
    new Intl.DateTimeFormat(
      'es-AR',
      {
        timeZone: applicationTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }
    ).formatToParts(date);

  return parts.find((item) => item.type === type)?.value || '';
}

export function todayInputValue(
  date = new Date()
) {
  return `${getZonedPart(date, 'year')}-${getZonedPart(date, 'month')}-${getZonedPart(date, 'day')}`;
}

export function toDateTimeLocalInputValue(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  const input =
    String(value);

  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) {
    const parsed =
      new Date(input);

    if (!Number.isNaN(parsed.getTime())) {
      return `${getZonedPart(parsed, 'year')}-${getZonedPart(parsed, 'month')}-${getZonedPart(parsed, 'day')}T${getZonedPart(parsed, 'hour')}:${getZonedPart(parsed, 'minute')}`;
    }
  }

  return input
    .replace(' ', 'T')
    .slice(0, 16);
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
      return `${getZonedPart(parsed, 'day')}-${getZonedPart(parsed, 'month')}-${getZonedPart(parsed, 'year')} ${getZonedPart(parsed, 'hour')}:${getZonedPart(parsed, 'minute')}`;
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
