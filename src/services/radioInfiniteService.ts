/** Issue #77: automatic Radio Infinite queue replenishment. */
import * as ExpoCrypto from 'expo-crypto';

import { addToQueue } from './playerService';
import { filterRadioInfiniteRecommendations } from './radioInfiniteFilter';
import { getApi } from './subsonicService';
import { authStore } from '../store/authStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { playbackSettingsStore } from '../store/playbackSettingsStore';
import { playerStore } from '../store/playerStore';

const ENDPOINT = 'https://radinf.sancti.fi/radio/recommendations';
let inFlight = false;

export async function refillRadioInfinite(): Promise<number> {
  if (inFlight) return 0;
  if (playbackSettingsStore.getState().repeatMode !== 'radio') {
    throw new Error('Select Radio Infinite repeat mode first.');
  }
  if (offlineModeStore.getState().offlineMode) throw new Error('Offline mode is enabled.');

  const auth = authStore.getState();
  if (!auth.isLoggedIn || !auth.username || !auth.password) throw new Error('Not logged in.');
  if (auth.legacyAuth) throw new Error('Radio Infinite requires salted-token authentication.');

  const state = playerStore.getState();
  const originalQueue = state.queue;
  const index = state.currentTrackIndex;
  if (!originalQueue.length || index == null || index < 0 || index >= originalQueue.length) return 0;
  // Three UPCOMING songs, excluding the currently playing song.
  if (originalQueue.length - index - 1 > 3) return 0;
  const seedIds = originalQueue.slice(-3).map((track) => track.id);
  const api = getApi();
  if (!api) throw new Error('Navidrome is unavailable.');

  const repeatGeneration = playbackSettingsStore.getState().repeatGeneration;
  inFlight = true;
  try {
    const salt = Array.from(await ExpoCrypto.getRandomBytesAsync(16))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const token = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.MD5,
      auth.password + salt,
      { encoding: ExpoCrypto.CryptoEncoding.HEX },
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: auth.username, token, salt, seed_ids: seedIds }),
    });
    if (!response.ok) throw new Error(`Radio bridge returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('song_ids' in payload) ||
        !Array.isArray(payload.song_ids) ||
        !payload.song_ids.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      throw new Error('Radio bridge returned an invalid song list.');
    }
    const ids = payload.song_ids as string[];
    if (!ids.length) throw new Error('Radio bridge returned no recommendations.');

    // Avoid adding recommendations already present in this queue, or repeated in this batch.
    const existingIds = new Set(originalQueue.map((song) => song.id));
    const distinctIds = [...new Set(ids)];
    const uniqueIds = distinctIds.filter((id) => !existingIds.has(id));
    if (!uniqueIds.length) return 0;
    const resolved = await Promise.all(uniqueIds.map(async (id) => {
      const result = await api.getSong({ id });
      if (result.status === 'failed' || result.status === 'fail' || !result.song || result.song.id !== id) {
        throw new Error(`Could not resolve recommended song ${id}.`);
      }
      return result.song;
    }));

    // Reject results if the mode, queue, login or network state changed during the request.
    const now = authStore.getState();
    if (playbackSettingsStore.getState().repeatMode !== 'radio' ||
        playbackSettingsStore.getState().repeatGeneration !== repeatGeneration ||
        offlineModeStore.getState().offlineMode ||
        playerStore.getState().queue !== originalQueue ||
        now.username !== auth.username || now.password !== auth.password ||
        now.serverUrl !== auth.serverUrl || now.legacyAuth !== auth.legacyAuth ||
        !now.isLoggedIn) {
      throw new Error('Playback queue or session changed; recommendations discarded.');
    }
    // A cleared queue must never fall through addToQueue's start-playback branch.
    if (!playerStore.getState().queue.length) return 0;

    // IDs were cheaply deduplicated before getSong(); now apply the metadata
    // rules against the queue and within this batch, preserving bridge order.
    const { radioMinDuration, radioMaxDuration } =
      playbackSettingsStore.getState();

    const eligible = filterRadioInfiniteRecommendations(
      originalQueue,
      resolved,
      {
        minDuration: radioMinDuration,
        maxDuration: radioMaxDuration,
      },
    );
    if (!eligible.length) return 0;

    const beforeAppend = playerStore.getState().queue.length;
    await addToQueue(eligible);
    // addToQueue may omit unplayable tracks; report observed queue growth.
    const queueLength = playerStore.getState().queue.length;
    const appended = Math.max(0, queueLength - beforeAppend);
    return appended;
  } finally {
    inFlight = false;
    // If Radio was disabled and re-enabled while this request was in flight,
    // the discarded old request must not suppress a refill for the new session.
    if (playbackSettingsStore.getState().repeatGeneration !== repeatGeneration &&
        playbackSettingsStore.getState().repeatMode === 'radio') {
      requestRadioInfiniteRefill();
    }
  }
}

/** Best-effort trigger. Native playback must continue if recommendations fail. */
export function requestRadioInfiniteRefill(): void {
  if (playbackSettingsStore.getState().repeatMode !== 'radio') return;
  if (inFlight) return;
  const state = playerStore.getState();
  const index = state.currentTrackIndex;
  if (index == null || index < 0 || !state.queue.length) return;
  if (state.queue.length - index - 1 > 3) return;
  void refillRadioInfinite().catch((error: unknown) => {
    console.warn('[RadioInfinite] Refill failed:', error instanceof Error ? error.message : String(error));
  });
}
