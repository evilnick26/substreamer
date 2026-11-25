import type { Child } from 'subsonic-api';

import {
  songKey,
  hasAdjacentArtistOrAlbum,
} from './recommendationFilters';

const MIN_RADIO_DURATION_SECONDS = 90;
const MAX_RADIO_DURATION_SECONDS = 480;

/**
 * Filter Radio Infinite recommendations without reordering them.
 * Compare adjacency with the queue tail or last accepted recommendation.
 */
export function filterRadioInfiniteRecommendations(
  queue: readonly Child[],
  candidates: readonly Child[],
): Child[] {
  const ids = new Set(queue.map((song) => song.id));
  const songs = new Set(
    queue.map(songKey).filter((key): key is string => key !== null),
  );

  const accepted: Child[] = [];
  const maxAccepted = 10;
  let previous = queue[queue.length - 1];

  for (const candidate of candidates) {
    const duration = candidate.duration;

    if (
      duration == null ||
      !Number.isFinite(duration) ||
      duration < MIN_RADIO_DURATION_SECONDS ||
      duration > MAX_RADIO_DURATION_SECONDS
    ) {
      continue;
    }

    const identity = songKey(candidate);

    if (ids.has(candidate.id)) continue;
    if (identity && songs.has(identity)) continue;

    if (previous && hasAdjacentArtistOrAlbum(candidate, previous)) {
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
