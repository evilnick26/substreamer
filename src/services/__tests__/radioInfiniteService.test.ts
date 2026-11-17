/** Issue #077: Radio Infinite refill orchestration tests. */
import type { Child } from 'subsonic-api';

const mockAddToQueue = jest.fn();
const mockGetSong = jest.fn();
let mockQueue: Child[] = [];
let mockIndex = 0;
let mockMode = 'radio';
let mockGeneration = 0;
let mockOffline = false;
let mockAuth = {
  isLoggedIn: true,
  username: 'tester',
  password: 'secret',
  legacyAuth: false,
  serverUrl: 'https://music.example.test',
};

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16)),
  digestStringAsync: jest.fn(async () => 'test-token'),
  CryptoDigestAlgorithm: { MD5: 'MD5' },
  CryptoEncoding: { HEX: 'hex' },
}));
jest.mock('../playerService', () => ({ addToQueue: (...args: unknown[]) => mockAddToQueue(...args) }));
jest.mock('../subsonicService', () => ({ getApi: () => ({ getSong: mockGetSong }) }));
jest.mock('../../store/authStore', () => ({ authStore: { getState: () => mockAuth } }));
jest.mock('../../store/offlineModeStore', () => ({ offlineModeStore: { getState: () => ({ offlineMode: mockOffline }) } }));
jest.mock('../../store/playbackSettingsStore', () => ({
  playbackSettingsStore: { getState: () => ({ repeatMode: mockMode, repeatGeneration: mockGeneration }) },
}));
jest.mock('../../store/playerStore', () => ({
  playerStore: { getState: () => ({ queue: mockQueue, currentTrackIndex: mockIndex }) },
}));

import { refillRadioInfinite } from '../radioInfiniteService';

const song = (id: string, artist: string, title: string, album = 'Album'): Child => ({
  id, artist, title, album, isDir: false,
});
const initial = () => [song('q1', 'Seed A', 'First'), song('q2', 'Seed B', 'Second')];

let originalFetch: typeof globalThis.fetch;
let infoSpy: jest.SpyInstance;

beforeAll(() => {
  originalFetch = globalThis.fetch;
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  infoSpy.mockRestore();
});

beforeEach(() => {
  mockQueue = initial();
  mockIndex = 1;
  mockMode = 'radio';
  mockGeneration = 0;
  mockOffline = false;
  mockAuth = {
    isLoggedIn: true, username: 'tester', password: 'secret',
    legacyAuth: false, serverUrl: 'https://music.example.test',
  };
  mockGetSong.mockReset();
  mockAddToQueue.mockReset();
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => ({
    status: 'ok', song: song(id, `Artist ${id}`, `Title ${id}`),
  }));
  mockAddToQueue.mockImplementation(async (tracks: Child[]) => {
    mockQueue = [...mockQueue, ...tracks];
  });
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ song_ids: ['a', 'b'] }),
  })) as unknown as typeof fetch;
});

test('appends resolved eligible recommendations in bridge order', async () => {
  await expect(refillRadioInfinite()).resolves.toBe(2);
  expect(mockGetSong).toHaveBeenCalledTimes(2);
  expect(mockAddToQueue).toHaveBeenCalledTimes(1);
  expect(mockAddToQueue.mock.calls[0][0].map((s: Child) => s.id)).toEqual(['a', 'b']);
  expect(mockQueue.map(s => s.id)).toEqual(['q1', 'q2', 'a', 'b']);
  const body = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.seed_ids).toEqual(['q1', 'q2']);
});

test('prefilters queue IDs and duplicate bridge IDs before getSong', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: true, json: async () => ({ song_ids: ['q1', 'a', 'a', 'b'] }),
  })) as unknown as typeof fetch;
  await expect(refillRadioInfinite()).resolves.toBe(2);
  expect(mockGetSong.mock.calls.map(([arg]) => arg.id)).toEqual(['a', 'b']);
});

test('applies metadata deduplication and adjacency before appending', async () => {
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => ({
    status: 'ok',
    song: id === 'a' ? song('a', 'Seed A', 'First') :
      id === 'b' ? song('b', 'Seed B', 'New song') : song(id, 'New Artist', 'New song'),
  }));
  globalThis.fetch = jest.fn(async () => ({
    ok: true, json: async () => ({ song_ids: ['a', 'b', 'c'] }),
  })) as unknown as typeof fetch;
  await expect(refillRadioInfinite()).resolves.toBe(1);
  expect(mockAddToQueue.mock.calls[0][0].map((s: Child) => s.id)).toEqual(['c']);
});

test('does not append when all resolved recommendations are filtered', async () => {
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => ({
    status: 'ok', song: song(id, 'Seed A', 'First'),
  }));
  await expect(refillRadioInfinite()).resolves.toBe(0);
  expect(mockAddToQueue).not.toHaveBeenCalled();
});

test('returns actual queue growth if the player drops unplayable tracks', async () => {
  mockAddToQueue.mockImplementation(async (tracks: Child[]) => {
    mockQueue = [...mockQueue, tracks[0]];
  });
  await expect(refillRadioInfinite()).resolves.toBe(1);
  expect(mockAddToQueue.mock.calls[0][0]).toHaveLength(2);
});

test('a failed getSong aborts the batch without modifying the queue', async () => {
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => ({
    status: id === 'b' ? 'failed' : 'ok',
    song: id === 'b' ? undefined : song(id, `Artist ${id}`, `Title ${id}`),
  }));
  await expect(refillRadioInfinite()).rejects.toThrow('Could not resolve recommended song b');
  expect(mockAddToQueue).not.toHaveBeenCalled();
  expect(mockQueue).toHaveLength(2);
});

test('discards recommendations if the queue changes while resolving', async () => {
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => {
    mockQueue = [...mockQueue];
    return { status: 'ok', song: song(id, `Artist ${id}`, `Title ${id}`) };
  });
  await expect(refillRadioInfinite()).rejects.toThrow('Playback queue or session changed');
  expect(mockAddToQueue).not.toHaveBeenCalled();
});

test.each(['mode', 'offline'] as const)('discards if %s changes during resolution', async (change) => {
  mockGetSong.mockImplementation(async ({ id }: { id: string }) => {
    if (change === 'mode') mockMode = 'all';
    else mockOffline = true;
    return { status: 'ok', song: song(id, `Artist ${id}`, `Title ${id}`) };
  });
  await expect(refillRadioInfinite()).rejects.toThrow('Playback queue or session changed');
  expect(mockAddToQueue).not.toHaveBeenCalled();
});

test('discards old session after Radio → Off → Radio and refills the new session', async () => {
  let releaseFirst!: () => void;
  const firstPending = new Promise<void>(resolve => { releaseFirst = resolve; });
  let calls = 0;
  globalThis.fetch = jest.fn(async () => {
    calls += 1;
    if (calls === 1) await firstPending;
    return { ok: true, json: async () => ({ song_ids: calls === 1 ? ['stale'] : ['fresh'] }) };
  }) as unknown as typeof fetch;

  const oldRequest = refillRadioInfinite();
  // The actual store increments on every *different* repeat mode, even if
  // the mode has returned to Radio by the time the network response arrives.
  mockMode = 'off';
  mockGeneration += 1;
  mockMode = 'radio';
  mockGeneration += 1;
  releaseFirst();

  await expect(oldRequest).rejects.toThrow('Playback queue or session changed');
  // finally() triggers a fresh, best-effort refill after releasing inFlight.
  for (let i = 0; i < 10 && mockQueue.length === 2; i += 1) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(mockQueue.map(s => s.id)).toEqual(['q1', 'q2', 'fresh']);
  expect(mockAddToQueue).toHaveBeenCalledTimes(1);
});

test('same repeat generation permits ordinary refill', async () => {
  await expect(refillRadioInfinite()).resolves.toBe(2);
  expect(mockAddToQueue).toHaveBeenCalledTimes(1);
});

test('serialises concurrent refills', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = jest.fn(async () => {
    await pending;
    return { ok: true, json: async () => ({ song_ids: ['a', 'b'] }) };
  }) as unknown as typeof fetch;
  const first = refillRadioInfinite();
  await expect(refillRadioInfinite()).resolves.toBe(0);
  release();
  await expect(first).resolves.toBe(2);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
