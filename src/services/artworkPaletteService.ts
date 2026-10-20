/**
 * Shared palette extraction. Cache by resolved URI, not album ID: when the
 * artwork URI changes, extraction runs again. Concurrent consumers share work.
 * Rejected requests are retryable; successful null results are cached.
 */
import { getImagePaletteAsync, type Palette } from 'expo-image-colors';

const completed = new Map<string, Palette | null>();
const pending = new Map<string, Promise<Palette | null>>();

export function getSharedArtworkPalette(uri: string): Promise<Palette | null> {
  if (completed.has(uri)) return Promise.resolve(completed.get(uri) ?? null);
  const existing = pending.get(uri);
  if (existing) return existing;
  const request = Promise.resolve()
    .then(() => getImagePaletteAsync(uri))
    .then((palette) => {
      completed.set(uri, palette);
      return palette;
    })
    .finally(() => { pending.delete(uri); });
  pending.set(uri, request);
  return request;
}

/** For isolated Jest tests only; never call from application code. */
export function clearArtworkPaletteCacheForTests(): void {
  completed.clear();
  pending.clear();
}
