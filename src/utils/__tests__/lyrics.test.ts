import { findActiveLyricIndex, isInlineLyricsEligible } from '../lyrics';
import type { LyricsData } from '../../services/subsonicService';

const data: LyricsData = { synced: true, source: 'structured', offsetMs: 0,
  lines: [{ startMs: 100, text: 'Original, Casing!' }, { startMs: 200, text: '' }] };

test('selects boundaries, duplicates, long gaps and last line without inventing end times', () => {
  expect(findActiveLyricIndex([], 100)).toBe(-1);
  expect(findActiveLyricIndex([100], NaN)).toBe(-1);
  expect(findActiveLyricIndex([100, 200, 200, 120000], 99)).toBe(-1);
  expect(findActiveLyricIndex([100, 200, 200, 120000], 100)).toBe(0);
  expect(findActiveLyricIndex([100, 200, 200, 120000], 200)).toBe(2);
  expect(findActiveLyricIndex([100, 200, 200, 120000], 119999)).toBe(2);
  expect(findActiveLyricIndex([100, 200, 200, 120000], 999999)).toBe(3);
});

test('only original valid structured synced data is eligible, including blank entries', () => {
  expect(isInlineLyricsEligible(data)).toBe(true);
  for (const value of [undefined, null, { ...data, synced: false }, { ...data, source: 'fake' },
    { ...data, source: 'classic' }, { ...data, lines: [] }, { ...data, offsetMs: NaN },
    { ...data, lines: [{ startMs: Infinity, text: '' }] }, { ...data, lines: [...data.lines].reverse() }]) {
    expect(isInlineLyricsEligible(value as LyricsData)).toBe(false);
  }
});
