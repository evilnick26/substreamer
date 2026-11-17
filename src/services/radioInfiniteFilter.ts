import type { Child } from 'subsonic-api';

/** Normalise only case and whitespace; keep complete titles and qualifiers. */
function normalise(value?: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function songKey(song: Child): string | null {
  const artist = normalise(song.artist);
  const title = normalise(song.title);
  return artist && title ? JSON.stringify([artist, title]) : null;
}

function albumKey(song: Child): string | null {
  const artist = normalise(
    song.albumArtists?.[0]?.name ||
    song.displayAlbumArtist ||
    song.artist,
  );
  const album = normalise(song.album);
  return artist && album ? JSON.stringify([artist, album]) : null;
}

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
    const identity = songKey(candidate);

    if (ids.has(candidate.id)) continue;
    if (identity && songs.has(identity)) continue;

    if (previous) {
      const artist = normalise(candidate.artist);
      const previousArtist = normalise(previous.artist);
      if (artist && previousArtist && artist === previousArtist) continue;

      const album = albumKey(candidate);
      if (album && album === albumKey(previous)) continue;
    }

    accepted.push(candidate);
    ids.add(candidate.id);
    if (identity) songs.add(identity);
    previous = candidate;
    if (accepted.length >= maxAccepted) break;
  }

  return accepted;
}
