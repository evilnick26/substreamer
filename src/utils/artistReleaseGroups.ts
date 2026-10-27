import type { AlbumID3 } from 'subsonic-api';

export type ArtistReleaseGroup = 'albums' | 'eps' | 'singles' | 'otherReleases';
export type ArtistReleaseListItem =
  | { type: 'header'; group: ArtistReleaseGroup }
  | { type: 'album'; album: AlbumID3 };

const GROUP_ORDER: readonly ArtistReleaseGroup[] = ['albums', 'eps', 'singles', 'otherReleases'];

export function classifyArtistRelease(releaseTypes: AlbumID3['releaseTypes']): ArtistReleaseGroup {
  let primary: ArtistReleaseGroup | undefined;
  for (const value of releaseTypes ?? []) {
    const token = value.trim().toLowerCase();
    const group = token === 'album' ? 'albums' : token === 'ep' ? 'eps' : token === 'single' ? 'singles' : undefined;
    if (!group) continue;
    if (primary && primary !== group) return 'otherReleases';
    primary = group;
  }
  return primary ?? 'otherReleases';
}

/** Partition an already sorted list without changing album objects or metadata. */
export function groupArtistReleases(albums: readonly AlbumID3[]): ArtistReleaseListItem[] {
  const groups: Record<ArtistReleaseGroup, AlbumID3[]> = {
    albums: [], eps: [], singles: [], otherReleases: [],
  };
  for (const album of albums) groups[classifyArtistRelease(album.releaseTypes)].push(album);
  return GROUP_ORDER.flatMap((group): ArtistReleaseListItem[] =>
    groups[group].length === 0 ? [] : [
      { type: 'header', group },
      ...groups[group].map((album): ArtistReleaseListItem => ({ type: 'album', album })),
    ],
  );
}
