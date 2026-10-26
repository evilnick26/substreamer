import type { LyricsData } from '../services/subsonicService';

/** Last timestamp at or before playback position; -1 before the first entry. */
export function findActiveLyricIndex(starts: readonly number[], positionMs: number): number {
  if (starts.length === 0 || !(positionMs >= starts[0])) return -1;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (starts[mid] <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function isInlineLyricsEligible(data: LyricsData | null | undefined): data is LyricsData {
  if (!data?.synced || data.source !== 'structured' || !Number.isFinite(data.offsetMs) || !data.lines.length) return false;
  return data.lines.every((line, i) => Number.isFinite(line.startMs)
    && (i === 0 || line.startMs >= data.lines[i - 1].startMs));
}
