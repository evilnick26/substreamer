import type { Child } from 'subsonic-api';

/** Normalise only case and whitespace; keep complete titles and qualifiers. */
function normalise(value?: string): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Identify equivalent songs independently of their physical file IDs. */
export function songKey(song: Child): string | null {
  const artist = normalise(song.artist);
  const title = normalise(song.title);
  return artist && title ? JSON.stringify([artist, title]) : null;
}

/** Identify albums using album artist and album title. */
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
 * Determine whether two songs violate artist or album adjacency rules.
 * Missing metadata does not constitute a match.
 */
export function hasAdjacentArtistOrAlbum(
  candidate: Child,
  previous: Child,
): boolean {
  const artist = normalise(candidate.artist);
  const previousArtist = normalise(previous.artist);

  if (artist && previousArtist && artist === previousArtist) {
    return true;
  }

  const album = albumKey(candidate);
  return album !== null && album === albumKey(previous);
}
