/** Issue #77: manual Radio Infinite bridge smoke test. No automatic refill yet. */
import * as ExpoCrypto from 'expo-crypto';

import { addToQueue } from './playerService';
import { getApi } from './subsonicService';
import { authStore } from '../store/authStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { playbackSettingsStore } from '../store/playbackSettingsStore';
import { playerStore } from '../store/playerStore';

const ENDPOINT = 'https://radinf.sancti.fi/radio/recommendations';
let inFlight = false;

export async function testRadioInfinite(): Promise<number> {
  if (inFlight) throw new Error('A Radio Infinite request is already running.');
  if (playbackSettingsStore.getState().repeatMode !== 'radio') {
    throw new Error('Select Radio Infinite repeat mode first.');
  }
  if (offlineModeStore.getState().offlineMode) throw new Error('Offline mode is enabled.');

  const auth = authStore.getState();
  if (!auth.isLoggedIn || !auth.username || !auth.password) throw new Error('Not logged in.');
  if (auth.legacyAuth) throw new Error('Radio Infinite requires salted-token authentication.');

  const originalQueue = playerStore.getState().queue;
  if (!originalQueue.length) throw new Error('The playback queue is empty.');
  const seedIds = originalQueue.slice(-3).map((track) => track.id);
  const api = getApi();
  if (!api) throw new Error('Navidrome is unavailable.');

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

    const resolved = await Promise.all(ids.map(async (id) => {
      const result = await api.getSong({ id });
      if (result.status === 'failed' || result.status === 'fail' || !result.song || result.song.id !== id) {
        throw new Error(`Could not resolve recommended song ${id}.`);
      }
      return result.song;
    }));

    // Reject results if the mode, queue, login or network state changed during the request.
    const now = authStore.getState();
    if (playbackSettingsStore.getState().repeatMode !== 'radio' ||
        offlineModeStore.getState().offlineMode ||
        playerStore.getState().queue !== originalQueue ||
        now.username !== auth.username || now.password !== auth.password ||
        now.serverUrl !== auth.serverUrl || now.legacyAuth !== auth.legacyAuth ||
        !now.isLoggedIn) {
      throw new Error('Playback queue or session changed; recommendations discarded.');
    }
    await addToQueue(resolved);
    return resolved.length;
  } finally {
    inFlight = false;
  }
}
