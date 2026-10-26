/**
 * Shared player lyrics fetch coordination. Owns the store selectors, the
 * fetch-attempt guard ref, the gated effect, and the retry handler. The
 * Shared by the phone (`player-phone-portrait.tsx`) and tablet
 * (`PlayerTabletLandscape.tsx`) surfaces.
 *
 * Fetch policy: lyrics load only while a player surface is on screen
 * (`enabled`) and the app is foreground. App-active is read here rather than at
 * each call site so no call site can forget it, and the effect re-runs when
 * either gate opens — so a player opened on an already-playing track loads that
 * track's lyrics instead of waiting for the next track change.
 *
 * No refresh handler: neither surface exposes one for lyrics, matching the
 * existing UX (refresh is album-info only).
 *
 * Timeout / error-reset semantics live inside `lyricsStore.fetchLyrics()`
 * (15s `withTimeout`), so this hook is a thin coordination layer.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAppActive } from './useAppActive';
import { loadLyricsSync } from '../store/persistence/lyricsTable';
import { lyricsStore, type LyricsErrorKind } from '../store/lyricsStore';
import { type LyricsData } from '../services/subsonicService';

export interface PlayerLyricsResult {
  entry: LyricsData | undefined;
  loading: boolean;
  error: LyricsErrorKind | null;
  handleRetry: () => void;
}

export function usePlayerLyrics(
  trackId: string | null,
  artist: string | null | undefined,
  title: string | null | undefined,
  /** Whether a player surface is actually on screen. */
  enabled: boolean,
): PlayerLyricsResult {
  const appActive = useAppActive();
  const shouldFetch = enabled && appActive;

  const memoryEntry = lyricsStore((s) => (trackId ? s.entries[trackId] : undefined));
  const loading = lyricsStore((s) => (trackId ? (s.loading[trackId] ?? false) : false));
  const error = lyricsStore((s) => (trackId ? (s.errors[trackId] ?? null) : null));

  const revision = lyricsStore((s) => s.revision);
  // Cache revisions can change when another track resolves. Re-read a missing
  // entry before paint rather than treating that change as ineligibility.
  const snapshot = useMemo(() => ({
    revision: lyricsStore.getState().revision,
    entry: trackId && shouldFetch && !lyricsStore.getState().entries[trackId]
      ? loadLyricsSync(trackId) : null,
  }), [trackId, shouldFetch, revision]);
  const entry = memoryEntry ?? (snapshot.revision === revision ? snapshot.entry ?? undefined : undefined);

  useEffect(() => {
    const cachedEntry = snapshot.entry;
    if (!trackId || !cachedEntry) return;
    lyricsStore.setState((s) => s.revision === snapshot.revision && !s.entries[trackId]
      ? { entries: { ...s.entries, [trackId]: cachedEntry }, revision: s.revision + 1 }
      : s);
  }, [trackId, snapshot]);

  /**
   * The track a fetch was last started for. Comparing by id IS the per-track
   * reset — a new track never matches, so it gets exactly one attempt.
   */
  const fetchAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    // Bail before touching the guard: marking a track attempted while gated off
    // would poison it, and it would never fetch once the player opens.
    if (!shouldFetch) return;
    if (!trackId || entry || loading) return;
    if (fetchAttemptedRef.current === trackId) return;
    fetchAttemptedRef.current = trackId;
    lyricsStore.getState().fetchLyrics(
      trackId,
      artist ?? undefined,
      title ?? undefined,
    );
  }, [shouldFetch, trackId, entry, loading, artist, title]);

  const handleRetry = useCallback(() => {
    if (!trackId) return;
    // User-initiated, so never gated. Records the attempt so the effect does not
    // fire a second fetch when this one settles.
    fetchAttemptedRef.current = trackId;
    lyricsStore.getState().fetchLyrics(
      trackId,
      artist ?? undefined,
      title ?? undefined,
    );
  }, [trackId, artist, title]);

  return { entry, loading, error, handleRetry };
}
