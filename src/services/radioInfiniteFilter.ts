import type { Child } from 'subsonic-api';

import {
  songKey,
  hasAdjacentArtistOrAlbum,
} from './recommendationFilters';

import {
  DEFAULT_RADIO_DURATION_POLICY,
  isRadioDurationEligible,
  type RadioDurationPolicy,
} from './radioInfiniteDuration';

export type RadioFilterRejection =
  | 'duration'
  | 'duplicate-id'
  | 'duplicate-song'
  | 'adjacency';

/**
 * Filter Radio Infinite recommendations without reordering them.
 * Compare adjacency with the queue tail or last accepted recommendation.
 */
export function filterRadioInfiniteRecommendations(
  queue: readonly Child[],
  candidates: readonly Child[],
  durationPolicy: Readonly<RadioDurationPolicy> = DEFAULT_RADIO_DURATION_POLICY,
  onReject?: (candidate: Child, reason: RadioFilterRejection) => void,
): Child[] {
  const ids = new Set(queue.map((song) => song.id));
  const songs = new Set(
    queue.map(songKey).filter((key): key is string => key !== null),
  );

  const accepted: Child[] = [];
  const maxAccepted = 10;
  let previous = queue[queue.length - 1];

  for (const candidate of candidates) {
    if (!isRadioDurationEligible(candidate.duration, durationPolicy)) {
      onReject?.(candidate, 'duration');
      continue;
    }

    const identity = songKey(candidate);

    if (ids.has(candidate.id)) {
      onReject?.(candidate, 'duplicate-id');
      continue;
    }
    if (identity && songs.has(identity)) {
      onReject?.(candidate, 'duplicate-song');
      continue;
    }

    if (previous && hasAdjacentArtistOrAlbum(candidate, previous)) {
      onReject?.(candidate, 'adjacency');
      continue;
    }

    accepted.push(candidate);
    ids.add(candidate.id);
    if (identity) songs.add(identity);
    previous = candidate;
    if (accepted.length >= maxAccepted) break;
  }

  return accepted;
}
