/**
 * Build the Now Playing album label from semantic metadata.
 * Missing values are omitted without leaving dangling separators.
 */
export function formatPlayerAlbumLabel(
  year: number | null | undefined,
  album: string | null | undefined,
  version: string | null | undefined,
): string {
  const parts: string[] = [];

  if (year != null && Number.isFinite(year) && year > 0) {
    parts.push(`(${year})`);
  }

  if (album?.trim()) parts.push(album.trim());
  if (version?.trim()) parts.push(version.trim());

  return parts.join(' - ');
}
