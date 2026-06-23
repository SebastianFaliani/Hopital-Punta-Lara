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
