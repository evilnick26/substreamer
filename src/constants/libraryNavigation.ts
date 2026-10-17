/** Stable navigation identifiers, independent of display labels and layout. */
export const DEFAULT_LIBRARY_ORDER = ['songs', 'albums', 'artists', 'playlists'] as const;
export type LibrarySegment = (typeof DEFAULT_LIBRARY_ORDER)[number];

/** Accept old, incomplete or malformed persisted preferences safely. */
export function normalizeLibraryOrder(value: unknown): LibrarySegment[] {
  const valid = new Set<string>(DEFAULT_LIBRARY_ORDER);
  const result: LibrarySegment[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && valid.has(item) && !result.includes(item as LibrarySegment)) {
        result.push(item as LibrarySegment);
      }
    }
  }
  for (const item of DEFAULT_LIBRARY_ORDER) {
    if (!result.includes(item)) result.push(item);
  }
  return result;
}
