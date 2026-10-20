/** Global artwork accent; independent of the NPS gradient hook. */
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { getSharedArtworkPalette } from '../services/artworkPaletteService';
import { useCachedCoverArt } from '../hooks/useCachedCoverArt';
import { playerStore } from '../store/playerStore';
import {
  ARTWORK_PRIMARY_COLOR,
  type ArtworkAccentPalette,
  themeStore,
} from '../store/themeStore';

export function ArtworkAccentController() {
  const enabled = themeStore((s) => s.primaryColor === ARTWORK_PRIMARY_COLOR);
  const track = playerStore((s) => s.currentTrack);
  const coverArt = enabled ? track?.coverArt ?? undefined : undefined;
  const albumId = enabled ? track?.albumId : undefined;
  const coverKey = coverArt ? `${coverArt}|${albumId ?? ''}` : null;
  const uri = useCachedCoverArt(coverArt, 300, albumId);
  const setArtworkAccent = themeStore((s) => s.setArtworkAccent);

  // The shared service deduplicates extraction. This effect alone controls
  // whether its result is still relevant to the current track.
  useEffect(() => {
    if (!enabled || !coverKey || Constants.appOwnership === 'expo') {
      setArtworkAccent(null);
      return;
    }
    if (!uri) return;

    let cancelled = false;
    const publish = (palette: ArtworkAccentPalette | null) => {
      if (cancelled) return;
      const current = playerStore.getState().currentTrack;
      const currentKey = current?.coverArt
        ? `${current.coverArt}|${current.albumId ?? ''}` : null;
      if (themeStore.getState().primaryColor === ARTWORK_PRIMARY_COLOR &&
          currentKey === coverKey) {
        setArtworkAccent({ coverKey, palette });
      }
    };
    getSharedArtworkPalette(uri)
      .then((result) => publish(result ? {
        dark: result.dark.primary,
        light: result.light.primary,
      } : null))
      .catch(() => publish(null));
    return () => { cancelled = true; };
  }, [enabled, coverKey, uri, setArtworkAccent]);

  return null;
}
