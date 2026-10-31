import i18next from 'i18next';

import { formatAddedDate, formatLongDate, formatShortDate, formatShortDateTime } from '../dateFormat';

it('formats a local added day using each existing month/day preference', () => {
  const date = new Date(2026, 9, 31, 12);
  expect(formatAddedDate(date, 'yyyy/mm/dd')).toBe('2026/10/31');
  expect(formatAddedDate(date, 'yyyy/dd/mm')).toBe('2026/31/10');
  expect(formatAddedDate(new Date(2026, 0, 2), 'yyyy/mm/dd')).toBe('2026/01/02');
});

it('accepts raw response strings and cached numeric timestamps as well as Dates', () => {
  const date = new Date(2026, 9, 31, 12);
  expect(formatAddedDate(date.toISOString(), 'yyyy/mm/dd')).toBe('2026/10/31');
  expect(formatAddedDate(date.getTime(), 'yyyy/mm/dd')).toBe('2026/10/31');
});

it.each([undefined, null, '', 'invalid', new Date('invalid'), '0001-01-01T00:00:00Z', 0])(
  'does not invent an added date for %s', (value) => {
    expect(formatAddedDate(value, 'yyyy/mm/dd')).toBe('—');
  },
);

it('preserves the existing locale-based formatters used by detail screens', async () => {
  const previousLanguage = i18next.language;
  try {
    await i18next.changeLanguage('en-GB');
    const date = new Date(2026, 9, 31, 12, 30);
    expect(formatLongDate(date)).toBe('31 October 2026');
    expect(formatShortDate(date)).toBe('31 Oct 2026');
    expect(formatShortDateTime(date)).toBe('31 Oct 2026, 12:30');
    for (const format of [formatLongDate, formatShortDate, formatShortDateTime]) {
      expect(format(undefined)).toBe('—');
      expect(format('invalid')).toBe('—');
    }
  } finally {
    await i18next.changeLanguage(previousLanguage);
  }
});
