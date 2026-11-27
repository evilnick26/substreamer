/** Issue #77: automatic Radio Infinite queue replenishment. */
import * as ExpoCrypto from 'expo-crypto';

import { appendRadioInfiniteRecommendations } from './playerService';
import {
  canRefillRadioInfinite,
  getRadioQueueRevision,
} from './radioInfiniteDispatcher';
import {
  buildRadioInfiniteSeedIds,
  radioInfiniteSeedSession,
} from './radioInfiniteSeed';
import { filterRadioInfiniteRecommendations } from './radioInfiniteFilter';
import { logRadioInfinite } from './radioInfiniteLogger';
import { getApi } from './subsonicService';
import { authStore } from '../store/authStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { playbackSettingsStore } from '../store/playbackSettingsStore';
import { playerStore } from '../store/playerStore';

const ENDPOINT = 'https://radinf.sancti.fi/radio/recommendations';
let inFlight = false;
let refillSequence = 0;

export async function refillRadioInfinite(): Promise<number> {
  if (inFlight || !canRefillRadioInfinite()) return 0;
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
  const { seed, generation: seedGeneration } =
    radioInfiniteSeedSession.getSnapshot();

  if (!seed) return 0;

  const queueRevision = getRadioQueueRevision();
  const seedIds = buildRadioInfiniteSeedIds(
    seed,
    originalQueue.map((track) => track.id),
  );
  const api = getApi();
  if (!api) throw new Error('Navidrome is unavailable.');

  const repeatGeneration = playbackSettingsStore.getState().repeatGeneration;

  const hasContextChanged = (): boolean =>
    playbackSettingsStore.getState().repeatGeneration !== repeatGeneration ||
    radioInfiniteSeedSession.getSnapshot().generation !== seedGeneration ||
    getRadioQueueRevision() !== queueRevision;

  const isContextCurrent = (): boolean => {
    const now = authStore.getState();

    return (
      canRefillRadioInfinite() &&
      !hasContextChanged() &&
      playbackSettingsStore.getState().repeatMode === 'radio' &&
      !offlineModeStore.getState().offlineMode &&
      playerStore.getState().queue === originalQueue &&
      now.username === auth.username &&
      now.password === auth.password &&
      now.serverUrl === auth.serverUrl &&
      now.legacyAuth === auth.legacyAuth &&
      now.isLoggedIn
    );
  };

  const refillId = `${Date.now()}-${++refillSequence}`;
  const log = (event: string, details: Record<string, unknown>): void => {
    logRadioInfinite(`REFILL ${event} ${JSON.stringify({ refillId, ...details })}`);
  };

  let phase = 'authentication';
  let outcome = 'failed';
  let appendedCount = 0;

  inFlight = true;
  try {
    log('started', {
      seed,
      seedGeneration,
      seedIds,
      queueRevision,
      queueLength: originalQueue.length,
      upcoming: originalQueue.length - index - 1,
    });
    const salt = Array.from(await ExpoCrypto.getRandomBytesAsync(16))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const token = await ExpoCrypto.digestStringAsync(
      ExpoCrypto.CryptoDigestAlgorithm.MD5,
      auth.password + salt,
      { encoding: ExpoCrypto.CryptoEncoding.HEX },
    );

    phase = 'bridge-request';
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: auth.username, token, salt, seed_ids: seedIds }),
    });
    if (!response.ok) {
      log('bridge-http-error', { status: response.status });
      throw new Error(`Radio bridge returned HTTP ${response.status}.`);
    }
    phase = 'bridge-response';
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('song_ids' in payload) ||
        !Array.isArray(payload.song_ids) ||
        !payload.song_ids.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      throw new Error('Radio bridge returned an invalid song list.');
    }
    const ids = payload.song_ids as string[];
    log('bridge-received', { count: ids.length, ids });
    if (!ids.length) {
      outcome = 'empty-response';
      throw new Error('Radio bridge returned no recommendations.');
    }

    // Avoid adding recommendations already present in this queue, or repeated in this batch.
    const existingIds = new Set(originalQueue.map((song) => song.id));
    const distinctIds = [...new Set(ids)];
    const uniqueIds = distinctIds.filter((id) => !existingIds.has(id));
    log('prefiltered', {
      duplicateBridgeCount: ids.length - distinctIds.length,
      alreadyQueuedIds: distinctIds.filter((id) => existingIds.has(id)),
      remainingIds: uniqueIds,
    });
    if (!uniqueIds.length) {
      outcome = 'all-prefiltered';
      return 0;
    }

    phase = 'metadata-resolution';
    const resolved = await Promise.all(uniqueIds.map(async (id) => {
      const result = await api.getSong({ id });
      if (result.status === 'failed' || result.status === 'fail' || !result.song || result.song.id !== id) {
        log('metadata-resolution-failed', { id });
        throw new Error(`Could not resolve recommended song ${id}.`);
      }
      return result.song;
    }));

    if (!isContextCurrent()) {
      outcome = 'stale-context';
      throw new Error('Playback queue or session changed; recommendations discarded.');
    }

    // IDs were cheaply deduplicated before getSong(); now apply the metadata
    // rules against the queue and within this batch, preserving bridge order.
    const { radioMinDuration, radioMaxDuration } =
      playbackSettingsStore.getState();

    phase = 'filtering';
    let rejectedCount = 0;
    const eligible = filterRadioInfiniteRecommendations(
      originalQueue,
      resolved,
      {
        minDuration: radioMinDuration,
        maxDuration: radioMaxDuration,
      },
      (candidate, reason) => {
        rejectedCount += 1;
        log('candidate-rejected', {
          id: candidate.id,
          artist: candidate.artist,
          title: candidate.title,
          duration: candidate.duration,
          reason,
        });
      },
    );
    log('filtered', {
      resolvedCount: resolved.length,
      rejectedCount,
      acceptedCount: eligible.length,
      unexaminedCount: resolved.length - rejectedCount - eligible.length,
      acceptedIds: eligible.map((track) => track.id),
      minDuration: radioMinDuration,
      maxDuration: radioMaxDuration,
    });
    if (!eligible.length) {
      outcome = 'all-filtered';
      return 0;
    }

    phase = 'queue-append';
    const appended = await appendRadioInfiniteRecommendations(
      eligible,
      seedGeneration,
      isContextCurrent,
      refillId,
    );

    appendedCount = appended.length;
    outcome = appendedCount > 0 ? 'appended' : 'nothing-appended';
    return appendedCount;
  } finally {
    inFlight = false;
    log('finished', { outcome, phase, appendedCount });
    // Reassess only when the request's context was superseded.
    if (hasContextChanged()) {
      requestRadioInfiniteRefill();
    }
  }
}

/** Best-effort trigger. Native playback must continue if recommendations fail. */
export function requestRadioInfiniteRefill(): void {
  if (playbackSettingsStore.getState().repeatMode !== 'radio') return;
  if (inFlight || !canRefillRadioInfinite()) return;
  if (offlineModeStore.getState().offlineMode) return;
  const state = playerStore.getState();
  const index = state.currentTrackIndex;
  if (index == null || index < 0 || index >= state.queue.length) return;
  if (state.queue.length - index - 1 > 3) return;
  void refillRadioInfinite().catch((error: unknown) => {
    console.warn('[RadioInfinite] Refill failed:', error instanceof Error ? error.message : String(error));
  });
}
