/**
 * Global accent presentation policy, independent of artwork extraction.
 *
 * A palette's coverKey is its provenance, not a condition for displaying the
 * last good colour while another cover resolves. The new track's palette will
 * replace it as soon as it is published. A resolved null palette is a genuine
 * fallback; no current artwork also falls back to Blue.
 */
import {
  ARTWORK_PRIMARY_COLOR,
  DEFAULT_PRIMARY_COLOR,
  type ThemeState,
} from '../store/themeStore';
import type { ResolvedTheme } from '../constants/theme';

export function resolveArtworkAccent(
  primaryColor: string | null,
  artworkAccent: ThemeState['artworkAccent'],
  currentCoverKey: string | null,
  theme: ResolvedTheme,
): string | null {
  if (primaryColor !== ARTWORK_PRIMARY_COLOR) return primaryColor;
  if (!currentCoverKey) return DEFAULT_PRIMARY_COLOR;
  if (!artworkAccent) return DEFAULT_PRIMARY_COLOR;
  if (artworkAccent.coverKey === currentCoverKey) {
    return artworkAccent.palette?.[theme] ?? DEFAULT_PRIMARY_COLOR;
  }
  // Pending new cover: retain the previous *valid* palette for presentation.
  // Its original coverKey remains unchanged in the store.
  return artworkAccent.palette?.[theme] ?? DEFAULT_PRIMARY_COLOR;
}
