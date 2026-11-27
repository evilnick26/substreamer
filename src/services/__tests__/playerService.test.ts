jest.mock('react-native', () => ({
  // expo-modules-core looks optional native modules up here when expo-file-system loads.
  TurboModuleRegistry: { get: () => null },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'android' },
}));

jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));

const mockSetCurrentTrack = jest.fn();
const mockSetPlaybackState = jest.fn();
const mockSetQueue = jest.fn();
const mockSetProgress = jest.fn();
const mockSetError = jest.fn();
const mockSetRetrying = jest.fn();
const mockSetQueueLoading = jest.fn();
const mockSetQueueFormats = jest.fn();
const mockAddQueueFormat = jest.fn();
const mockClearQueueFormats = jest.fn();
const mockSetTrackSource = jest.fn();
const mockPlayerStoreSetState = jest.fn();

jest.mock('../../store/playerStore', () => ({
  playerStore: {
    getState: jest.fn(() => ({
      currentTrack: null,
      currentTrackIndex: null,
      queue: [],
      position: 0,
      duration: 100,
      bufferedPosition: 0,
      error: null,
      retrying: false,
      playbackState: 'idle',
      setCurrentTrack: mockSetCurrentTrack,
      setPlaybackState: mockSetPlaybackState,
      setQueue: mockSetQueue,
      setProgress: mockSetProgress,
      setError: mockSetError,
      setRetrying: mockSetRetrying,
      setQueueLoading: mockSetQueueLoading,
      setQueueFormats: mockSetQueueFormats,
      addQueueFormat: mockAddQueueFormat,
      clearQueueFormats: mockClearQueueFormats,
      setTrackSource: mockSetTrackSource,
    })),
    setState: (...args: unknown[]) => mockPlayerStoreSetState(...args),
  },
}));

const mockToastFail = jest.fn();
jest.mock('../../store/playbackToastStore', () => ({
  playbackToastStore: {
    getState: jest.fn(() => ({ show: jest.fn(), succeed: jest.fn(), fail: mockToastFail })),
  },
}));

jest.mock('../../store/serverInfoStore', () => ({
  serverInfoStore: { getState: jest.fn(() => ({ extensions: [] })) },
}));

jest.mock('../scrobbleService', () => ({
  addCompletedScrobble: jest.fn(),
  sendNowPlaying: jest.fn(),
}));

jest.mock('../imageCacheService', () => ({
  resolveDisplayImages: jest.fn(async (subjects: unknown[]) =>
    subjects.map(() => ({ coverArtId: undefined, uri: null, isRemote: false }))),
}));

jest.mock('../musicCacheService', () => ({
  getLocalTrackUri: jest.fn().mockReturnValue(null),
  waitForTrackMapsReady: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../store/musicCacheStore', () => ({
  musicCacheStore: { getState: jest.fn(() => ({ cachedSongs: {} })) },
  // Nothing downloaded here, so the queue builder's completion pass is a pass-through.
  completeSongFromCache: (song: unknown) => song,
}));

const mockOfflineMode = { offlineMode: false };
const mockOfflineListeners: Array<(next: { offlineMode: boolean }, prev: { offlineMode: boolean }) => void> = [];
function mockSetOfflineMode(offlineMode: boolean): void {
  const prev = { ...mockOfflineMode };
  mockOfflineMode.offlineMode = offlineMode;
  if (prev.offlineMode !== offlineMode) {
    for (const listener of mockOfflineListeners) listener({ ...mockOfflineMode }, prev);
  }
}
jest.mock('../../store/offlineModeStore', () => ({
  offlineModeStore: {
    getState: jest.fn(() => mockOfflineMode),
    // Model Zustand's synchronous transition notifications for fallback tests.
    subscribe: jest.fn((listener) => {
      mockOfflineListeners.push(listener);
      return () => {
        const index = mockOfflineListeners.indexOf(listener);
        if (index >= 0) mockOfflineListeners.splice(index, 1);
      };
    }),
  },
}));

jest.mock('../radioInfiniteDispatcher', () => ({
  ...jest.requireActual('../radioInfiniteDispatcher'),
  requestRadioInfiniteRefill: jest.fn(),
}));

jest.mock('../subsonicService');

const mockPersistQueue = jest.fn();
const mockPersistCurrentIndex = jest.fn();
const mockClearPersistedQueue = jest.fn();
const mockGetPersistedQueue = jest.fn().mockReturnValue(null);
const mockGetPersistedPosition = jest.fn().mockReturnValue(null);

jest.mock('../queuePersistenceService', () => ({
  persistRadioSeed: jest.fn(),
  getPersistedRadioSeed: jest.fn(() => null),
  persistQueue: (...args: unknown[]) => mockPersistQueue(...args),
  persistCurrentIndex: (...args: unknown[]) => mockPersistCurrentIndex(...args),
  persistPositionIfDue: jest.fn(),
  flushPosition: jest.fn(),
  clearPersistedQueue: () => mockClearPersistedQueue(),
  getPersistedQueue: () => mockGetPersistedQueue(),
  getPersistedPosition: () => mockGetPersistedPosition(),
}));

import { playbackSettingsStore } from '../../store/playbackSettingsStore';
import { addCompletedScrobble, sendNowPlaying } from '../scrobbleService';
import { getCoverArtUrl, getStreamUrl, type Child } from '../subsonicService';
import {
  initPlayer,
  restorePersistedQueueAfterBoot,
  playTrack,
  togglePlayPause,
  skipToNext,
  skipToPrevious,
  seekTo,
  skipToTrack,
  retryPlayback,
  clearQueue,
  addToQueue,
  appendRadioInfiniteRecommendations,
  removeFromQueue,
  removeNonDownloadedTracks,
  cycleRepeatMode,
  applyPlaybackRate,
  shuffleQueue,
  canSkipToPrevious,
  applyLocalPlayToPlayer,
  playSongNext,
  rebuildQueueForServerSwitch,
  updateRemoteCapabilities,
  applyPlaybackMode,
  applyPitchCorrection,
  applyReplayGain,
  applyEqualizerConfig,
  setEqualizerEnabled,
  applyEqualizerPreset,
  setEqualizerBandGain,
  resetEqualizer,
  saveEqualizerPreset,
  deleteEqualizerPreset,
} from '../playerService';
import { equalizerSettingsStore, EQ_CUSTOM_PRESET_LABEL } from '../../store/equalizerSettingsStore';

// The global __mocks__/react-native-queue-player.js exposes the shared player
// instance + an event emitter.
const rnqp = require('react-native-queue-player');
const mockTP = rnqp.__trackPlayer as Record<string, jest.Mock>;
const mockEq = rnqp.__equalizer as Record<string, jest.Mock>;
const emit = rnqp.__emit as (name: string, ...args: unknown[]) => void;

const makeChild = (id: string, overrides?: Partial<Child>): Child => ({
  id,
  title: `Song ${id}`,
  artist: 'Test Artist',
  album: 'Test Album',
  coverArt: `cover-${id}`,
  duration: 200,
  ...overrides,
} as Child);

const defaultPlayerState = () => ({
  currentTrack: null,
  currentTrackIndex: null,
  queue: [],
  position: 0,
  duration: 100,
  bufferedPosition: 0,
  error: null,
  retrying: false,
  playbackState: 'idle',
  setCurrentTrack: mockSetCurrentTrack,
  setPlaybackState: mockSetPlaybackState,
  setQueue: mockSetQueue,
  setProgress: mockSetProgress,
  setError: mockSetError,
  setRetrying: mockSetRetrying,
  setQueueLoading: mockSetQueueLoading,
  setQueueFormats: mockSetQueueFormats,
  addQueueFormat: mockAddQueueFormat,
  clearQueueFormats: mockClearQueueFormats,
  setTrackSource: mockSetTrackSource,
});

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
  // initPlayer is idempotent; call once to register the RNQP event listeners.
  await initPlayer();
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await clearQueue();
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();

  const { playerStore } = require('../../store/playerStore');
  (playerStore.getState as jest.Mock).mockReturnValue(defaultPlayerState());
  // clearAllMocks keeps persistent return values; pin the engine's idle defaults.
  mockTP.getState.mockReturnValue('none');
  mockTP.getCurrentTrackIndex.mockReturnValue(-1);

  // Restore online state BEFORE changing repeat mode, avoiding test-to-test
  // fallback notifications while resetting a previous offline scenario.
  mockSetOfflineMode(false);
  playbackSettingsStore.setState({
    repeatMode: 'off',
    radioOfflineFallback: 'all',
    playbackRate: 1,
    maxBitRate: null,
    streamFormat: 'raw',
    estimateContentLength: false,
    remoteControlMode: 'skip-track',
    skipForwardInterval: 15,
    skipBackwardInterval: 15,
  } as any);

  (getCoverArtUrl as jest.Mock).mockReturnValue('https://example.com/art.jpg');
  (getStreamUrl as jest.Mock).mockReturnValue('https://example.com/stream.mp3');
  mockGetPersistedQueue.mockReturnValue(null);
  mockGetPersistedPosition.mockReturnValue(null);
});

describe('initPlayer', () => {
  it('registered the RNQP player + emitter used by these tests', () => {
    expect(typeof mockTP.setQueue).toBe('function');
    expect(typeof emit).toBe('function');
  });
});

describe('restorePersistedQueueAfterBoot — live car-session adoption', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('adopts a live (playing) car session: no engine re-drive, ignores the stale persisted queue', async () => {
    // A car/Siri browse tap started playback THIS process — playTrack sets currentChildQueue.
    const carQueue = [makeChild('c1'), makeChild('c2')];
    await playTrack(carQueue[0], carQueue);
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    mockTP.seekTo.mockClear();
    mockSetCurrentTrack.mockClear();

    // Engine reports a live playing session; a STALE queue sits on disk.
    mockTP.getState.mockReturnValue('playing');
    mockTP.getCurrentTrackIndex.mockReturnValue(0);
    mockGetPersistedQueue.mockReturnValue({ queue: [makeChild('OLD')], currentTrackIndex: 0 });

    restorePersistedQueueAfterBoot();

    // Did NOT re-drive the engine (no restart); adopted the LIVE track, not 'OLD'.
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
    expect(mockTP.seekTo).not.toHaveBeenCalled();
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), 0);
  });

  it('preserves the live Radio Infinite Primary and lifespan during adoption', async () => {
    const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
    const { getPersistedRadioSeed } = require('../queuePersistenceService');

    playbackSettingsStore.getState().setRepeatMode('radio');

    const carQueue = [makeChild('c1'), makeChild('c2')];
    await playTrack(carQueue[0], carQueue);

    const { generation } = radioInfiniteSeedSession.getSnapshot();
    radioInfiniteSeedSession.completeRefill(generation, ['recommendation']);

    const previous = radioInfiniteSeedSession.getSnapshot();

    mockTP.getState.mockReturnValue('playing');
    mockTP.getCurrentTrackIndex.mockReturnValue(1);
    mockGetPersistedQueue.mockReturnValue({
      queue: [makeChild('OLD')],
      currentTrackIndex: 0,
    });

    getPersistedRadioSeed.mockClear();
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();

    restorePersistedQueueAfterBoot();

    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(getPersistedRadioSeed).not.toHaveBeenCalled();
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c2' }),
      1,
    );
  });

  it('adopts a PAUSED car session without restarting', async () => {
    const carQueue = [makeChild('c1')];
    await playTrack(carQueue[0], carQueue);
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();

    mockTP.getState.mockReturnValue('paused');
    mockTP.getCurrentTrackIndex.mockReturnValue(0);

    restorePersistedQueueAfterBoot();

    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
  });

  it('falls through to the normal restore when the engine is empty', async () => {
    mockTP.getState.mockReturnValue('none');
    mockTP.getCurrentTrackIndex.mockReturnValue(-1);
    mockGetPersistedQueue.mockReturnValue({
      queue: [makeChild('p1'), makeChild('p2')],
      currentTrackIndex: 1,
    });

    restorePersistedQueueAfterBoot();
    await flush();

    // restorePersistedQueue() seeded the store from the persisted queue (index 1).
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }), 1);
  });

  it('does NOT adopt an ended leftover queue — falls through to restore', async () => {
    mockTP.getState.mockReturnValue('ended');
    mockTP.getCurrentTrackIndex.mockReturnValue(0);
    mockGetPersistedQueue.mockReturnValue({ queue: [makeChild('p1')], currentTrackIndex: 0 });

    restorePersistedQueueAfterBoot();
    await flush();

    expect(mockSetCurrentTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 0);
  });
});

describe('playTrack', () => {
  it('loads the queue at the tapped index and plays', async () => {
    const queue = [makeChild('t1'), makeChild('t2'), makeChild('t3')];
    await playTrack(queue[1], queue);

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    const [tracks, startIndex] = mockTP.setQueue.mock.calls[0];
    expect(tracks).toHaveLength(3);
    expect(tracks[0].id).toBe('t1');
    expect(startIndex).toBe(1);
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('starts at 0 when the tapped track is the first', async () => {
    const queue = [makeChild('t1'), makeChild('t2')];
    await playTrack(queue[0], queue);
    expect(mockTP.setQueue.mock.calls[0][1]).toBe(0);
  });

  it('shows failure toast on error', async () => {
    mockTP.setQueue.mockRejectedValueOnce(new Error('boom'));
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    expect(mockToastFail).toHaveBeenCalled();
  });

  it('updates the queue in the store', async () => {
    const queue = [makeChild('t1')];
    await playTrack(queue[0], queue);
    expect(mockSetQueue).toHaveBeenCalledWith(queue);
  });
});

describe('togglePlayPause', () => {
  it('pauses when playing', async () => {
    mockTP.getState.mockReturnValueOnce('playing');
    await togglePlayPause();
    expect(mockTP.pause).toHaveBeenCalled();
  });

  it('plays when paused', async () => {
    mockTP.getState.mockReturnValueOnce('paused');
    await togglePlayPause();
    expect(mockTP.play).toHaveBeenCalled();
    expect(mockTP.skipToIndex).not.toHaveBeenCalled();
  });

  it('after the queue ended, restarts the last active track from 0 then plays', async () => {
    mockTP.getState.mockReturnValueOnce('ended');
    mockTP.getCurrentTrackIndex.mockReturnValueOnce(4);
    await togglePlayPause();
    expect(mockTP.skipToIndex).toHaveBeenCalledWith(4);
    expect(mockTP.play).toHaveBeenCalledTimes(1);
    expect(mockTP.skipToIndex.mock.invocationCallOrder[0]).toBeLessThan(
      mockTP.play.mock.invocationCallOrder[0],
    );
  });
});

describe('transport passthroughs', () => {
  it('skipToNext / skipToPrevious', async () => {
    await skipToNext();
    expect(mockTP.skipToNext).toHaveBeenCalled();
    await skipToPrevious();
    expect(mockTP.skipToPrevious).toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
  });

  it.each(['playing', 'paused', 'buffering'] as const)(
    'a skip from %s never adds a play',
    async (state) => {
      mockTP.getState.mockReturnValue(state);
      await skipToNext();
      await skipToPrevious();
      expect(mockTP.play).not.toHaveBeenCalled();
    },
  );

  it('a skip after the queue ended plays once the skip has landed', async () => {
    mockTP.getState.mockReturnValueOnce('ended');
    await skipToNext();
    expect(mockTP.play).toHaveBeenCalledTimes(1);
    expect(mockTP.skipToNext.mock.invocationCallOrder[0]).toBeLessThan(
      mockTP.play.mock.invocationCallOrder[0],
    );

    mockTP.play.mockClear();
    mockTP.getState.mockReturnValueOnce('ended');
    await skipToPrevious();
    expect(mockTP.play).toHaveBeenCalledTimes(1);
  });

  it('seekTo passes through and clamps negatives to 0', async () => {
    await seekTo(60);
    expect(mockTP.seekTo).toHaveBeenCalledWith(60);
    await seekTo(-10);
    expect(mockTP.seekTo).toHaveBeenCalledWith(0);
  });

  it('skipToTrack skips to the index and plays', async () => {
    await skipToTrack(3);
    expect(mockTP.skipToIndex).toHaveBeenCalledWith(3);
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('retryPlayback clears the error and re-attempts', async () => {
    await retryPlayback();
    expect(mockSetError).toHaveBeenCalledWith(null);
    expect(mockTP.retry).toHaveBeenCalled();
  });
});

describe('canSkipToPrevious', () => {
  it('false when no track / empty queue', () => {
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: null, queue: [],
    });
    expect(canSkipToPrevious()).toBe(false);
  });

  it('true when a track is loaded', () => {
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: 0, queue: [{ id: '1' }],
    });
    expect(canSkipToPrevious()).toBe(true);
  });
});

describe('clearQueue', () => {
  it('clears the native queue and resets store state', async () => {
    await clearQueue();
    expect(mockTP.clearQueue).toHaveBeenCalled();
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(null);
    expect(mockSetQueue).toHaveBeenCalledWith([]);
    expect(mockSetPlaybackState).toHaveBeenCalledWith('idle');
    expect(mockSetProgress).toHaveBeenCalledWith(0, 0, 0);
    expect(mockClearPersistedQueue).toHaveBeenCalled();
  });
});

describe('rebuildQueueForServerSwitch', () => {
  it('no-ops when the queue is empty', async () => {
    mockTP.setQueue.mockClear();
    await rebuildQueueForServerSwitch();
    expect(mockTP.setQueue).not.toHaveBeenCalled();
  });

  it('rebuilds with new URLs, preserves index + position, resumes playback', async () => {
    const queue = [makeChild('t1'), makeChild('t2'), makeChild('t3')];
    await playTrack(queue[1], queue);
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    mockTP.seekTo.mockClear();

    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: 1, position: 42, playbackState: 'playing', queue,
    });
    (getStreamUrl as jest.Mock).mockImplementation((id: string) => `https://secondary.example.com/stream/${id}`);

    await rebuildQueueForServerSwitch();

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    const [tracks, idx] = mockTP.setQueue.mock.calls[0];
    expect(tracks).toHaveLength(3);
    expect(tracks[1].url).toBe('https://secondary.example.com/stream/t2');
    expect(idx).toBe(1);
    expect(mockTP.seekTo).toHaveBeenCalledWith(42);
    expect(mockTP.play).toHaveBeenCalledTimes(1);
  });

  it('does not resume play when paused', async () => {
    const queue = [makeChild('t1')];
    await playTrack(queue[0], queue);
    mockTP.play.mockClear();
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: 0, playbackState: 'paused', queue,
    });
    await rebuildQueueForServerSwitch();
    expect(mockTP.play).not.toHaveBeenCalled();
  });
});

describe('playSongNext', () => {
  it('starts fresh playback when the queue is empty', async () => {
    await clearQueue();
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    await playSongNext(makeChild('new-song'));
    expect(mockTP.setQueue).toHaveBeenCalled();
    expect(mockTP.play).toHaveBeenCalled();
    expect(mockTP.setQueue.mock.calls[0][0][0].id).toBe('new-song');
  });

  it('inserts at currentIndex + 1 when the queue has tracks', async () => {
    const queue = [makeChild('a'), makeChild('b'), makeChild('c')];
    await playTrack(queue[1], queue);
    mockTP.addToQueue.mockClear();
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: 1, queue,
    });
    await playSongNext(makeChild('inserted'));
    expect(mockTP.addToQueue).toHaveBeenCalledTimes(1);
    expect(mockTP.addToQueue.mock.calls[0][0][0].id).toBe('inserted');
    expect(mockTP.addToQueue.mock.calls[0][1]).toBe(2);
  });

  it('does not disturb current playback (no setQueue/play)', async () => {
    const queue = [makeChild('a'), makeChild('b')];
    await playTrack(queue[0], queue);
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrackIndex: 0, queue,
    });
    await playSongNext(makeChild('next'));
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
  });
});

describe('offline-mode queue building', () => {
  it('playTrack filters non-cached tracks when offline and refocuses on a cached one', async () => {
    const { getLocalTrackUri } = require('../musicCacheService');
    (getLocalTrackUri as jest.Mock).mockImplementation((id: string) => (id === 't2' ? '/local/t2.mp3' : null));
    mockOfflineMode.offlineMode = true;
    await playTrack(makeChild('t1'), [makeChild('t1'), makeChild('t2'), makeChild('t3')]);
    const tracks = mockTP.setQueue.mock.calls.at(-1)?.[0] as Array<{ id: string }>;
    expect(tracks.map((t) => t.id)).toEqual(['t2']);
    expect(mockTP.setQueue.mock.calls.at(-1)?.[1]).toBe(0);
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('playTrack clears + toasts when all tracks are non-cached offline', async () => {
    const { getLocalTrackUri } = require('../musicCacheService');
    (getLocalTrackUri as jest.Mock).mockReturnValue(null);
    mockOfflineMode.offlineMode = true;
    mockTP.setQueue.mockClear();
    await playTrack(makeChild('t1'), [makeChild('t1'), makeChild('t2')]);
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockToastFail).toHaveBeenCalled();
    expect(mockSetQueue).toHaveBeenCalledWith([]);
  });

  it('leaves non-cached tracks when online', async () => {
    const { getLocalTrackUri } = require('../musicCacheService');
    (getLocalTrackUri as jest.Mock).mockReturnValue(null);
    mockOfflineMode.offlineMode = false;
    await playTrack(makeChild('t1'), [makeChild('t1'), makeChild('t2'), makeChild('t3')]);
    const tracks = mockTP.setQueue.mock.calls.at(-1)?.[0] as Array<{ id: string }>;
    expect(tracks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('addToQueue', () => {
  it('does nothing for an empty array', async () => {
    await addToQueue([]);
    expect(mockTP.addToQueue).not.toHaveBeenCalled();
  });

  it('starts playback when the queue is empty', async () => {
    await clearQueue();
    mockTP.setQueue.mockClear();
    await addToQueue([makeChild('t1'), makeChild('t2')]);
    expect(mockTP.setQueue).toHaveBeenCalled();
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('appends when the queue has items', async () => {
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.addToQueue.mockClear();
    await addToQueue([makeChild('t2'), makeChild('t3')]);
    expect(mockTP.addToQueue).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 't2' }),
        expect.objectContaining({ id: 't3' }),
      ]),
    );
  });
});

describe('removeFromQueue', () => {
  it('ignores out-of-bounds index', async () => {
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.removeFromQueue.mockClear();
    await removeFromQueue(5);
    expect(mockTP.removeFromQueue).not.toHaveBeenCalled();
  });

  it('clears the queue when removing the only track', async () => {
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.clearQueue.mockClear();
    await removeFromQueue(0);
    expect(mockTP.clearQueue).toHaveBeenCalled();
  });

  it('removes by index batch when more than one track', async () => {
    await playTrack(makeChild('a'), [makeChild('a'), makeChild('b')]);
    mockTP.removeFromQueue.mockClear();
    await removeFromQueue(0);
    expect(mockTP.removeFromQueue).toHaveBeenCalledWith([0]);
  });
});

describe('removeNonDownloadedTracks', () => {
  const { getLocalTrackUri } = jest.requireMock('../musicCacheService');
  const downloaded = (...ids: string[]) =>
    (getLocalTrackUri as jest.Mock).mockImplementation((id: string) => (ids.includes(id) ? `/local/${id}` : null));

  afterEach(() => {
    (getLocalTrackUri as jest.Mock).mockReset().mockReturnValue(null);
  });

  it('removes streamed tracks but keeps the playing one', async () => {
    const queue = ['a', 'b', 'c', 'd'].map((id) => makeChild(id));
    await playTrack(queue[2], queue);
    downloaded('b');
    mockTP.getCurrentTrackIndex.mockReturnValue(2);
    mockTP.removeFromQueue.mockClear();
    mockTP.clearQueue.mockClear();

    await removeNonDownloadedTracks();

    expect(mockTP.removeFromQueue.mock.calls).toEqual([[[3]], [[0]]]);
    expect(mockTP.clearQueue).not.toHaveBeenCalled();
  });

  it('clears the queue when every track is streamed', async () => {
    const queue = ['a', 'b'].map((id) => makeChild(id));
    await playTrack(queue[0], queue);
    downloaded();
    mockTP.removeFromQueue.mockClear();
    mockTP.clearQueue.mockClear();

    await removeNonDownloadedTracks();

    expect(mockTP.clearQueue).toHaveBeenCalled();
    expect(mockTP.removeFromQueue).not.toHaveBeenCalled();
  });

  it('does nothing when every track is downloaded', async () => {
    const queue = ['a', 'b'].map((id) => makeChild(id));
    await playTrack(queue[0], queue);
    downloaded('a', 'b');
    mockTP.removeFromQueue.mockClear();
    mockTP.clearQueue.mockClear();

    await removeNonDownloadedTracks();

    expect(mockTP.removeFromQueue).not.toHaveBeenCalled();
    expect(mockTP.clearQueue).not.toHaveBeenCalled();
  });
});

describe('cycleRepeatMode', () => {
  it('off -> all (queue)', async () => {
    playbackSettingsStore.setState({ repeatMode: 'off' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith('queue');
  });
  it('all -> one (track)', async () => {
    playbackSettingsStore.setState({ repeatMode: 'all' } as any);
    await cycleRepeatMode();
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith('track');
  });
  it('one -> radio (native off)', async () => {
    playbackSettingsStore.setState({ repeatMode: 'one' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('radio');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith('off');
  });
  it('radio -> off', async () => {
    playbackSettingsStore.setState({ repeatMode: 'radio' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('off');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith('off');
  });
});

describe('Radio Infinite offline fallback — regression', () => {
  // Native repeat updates are serialized through a promise chain; drain it
  // before inspecting the mock, rather than relying on arbitrary timeouts.
  const drain = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

  it('switches Radio to Repeat All when Offline Mode activates (default)', async () => {
    playbackSettingsStore.getState().setRepeatMode('radio');
    const generation = playbackSettingsStore.getState().repeatGeneration;
    mockSetOfflineMode(true);
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(playbackSettingsStore.getState().repeatGeneration).toBe(generation + 1);
    await drain();
    expect(mockTP.setRepeatMode).toHaveBeenLastCalledWith('queue');
  });

  it('honours configured Repeat Off instead of Repeat All', async () => {
    playbackSettingsStore.getState().setRadioOfflineFallback('off');
    playbackSettingsStore.getState().setRepeatMode('radio');
    mockSetOfflineMode(true);
    expect(playbackSettingsStore.getState().repeatMode).toBe('off');
    await drain();
    expect(mockTP.setRepeatMode).toHaveBeenLastCalledWith('off');
  });

  it('does not restore Radio or request recommendations when returning online', async () => {
    playbackSettingsStore.getState().setRepeatMode('radio');
    mockSetOfflineMode(true);
    await drain();
    mockTP.setRepeatMode.mockClear();
    const { requestRadioInfiniteRefill } = require('../radioInfiniteDispatcher');
    (requestRadioInfiniteRefill as jest.Mock).mockClear();
    mockSetOfflineMode(false);
    await drain();
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(mockTP.setRepeatMode).not.toHaveBeenCalled();
    expect(requestRadioInfiniteRefill).not.toHaveBeenCalled();
  });

  it('immediately rejects selecting Radio while already offline', async () => {
    mockSetOfflineMode(true);
    playbackSettingsStore.getState().setRepeatMode('radio');
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    await drain();
    expect(mockTP.setRepeatMode).toHaveBeenLastCalledWith('queue');
  });

  it('does not alter an existing non-Radio repeat mode when going offline', async () => {
    playbackSettingsStore.getState().setRepeatMode('one');
    mockSetOfflineMode(true);
    await drain();
    expect(playbackSettingsStore.getState().repeatMode).toBe('one');
    expect(mockTP.setRepeatMode).not.toHaveBeenCalled();
  });

  it('serializes a pending native repeat update before the offline fallback', async () => {
    let releaseFirst!: () => void;
    const pending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    mockTP.setRepeatMode.mockImplementationOnce(() => pending);
    playbackSettingsStore.setState({ repeatMode: 'one' } as any);
    const cycling = cycleRepeatMode(); // one -> radio; native 'off' pending
    await drain();
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith('off');
    mockSetOfflineMode(true); // fallback -> all; native 'queue' queued
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(mockTP.setRepeatMode).toHaveBeenCalledTimes(1);
    releaseFirst();
    await cycling;
    await drain();
    expect(mockTP.setRepeatMode.mock.calls.map((call: unknown[]) => call[0])).toEqual(['off', 'queue']);
  });

  it('keeps the offline fallback after rapid offline-online-offline transitions', async () => {
    playbackSettingsStore.getState().setRepeatMode('radio');
    mockSetOfflineMode(true);
    mockSetOfflineMode(false);
    mockSetOfflineMode(true);
    await drain();
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(mockTP.setRepeatMode).toHaveBeenLastCalledWith('queue');
  });
});

describe('applyPlaybackRate', () => {
  it('sets the store rate and the native speed', async () => {
    playbackSettingsStore.setState({ playbackRate: 1 } as any);
    await applyPlaybackRate(1.5);
    expect(playbackSettingsStore.getState().playbackRate).toBe(1.5);
    expect(mockTP.setPlaybackSpeed).toHaveBeenCalledWith(1.5);
  });
});

describe('updateRemoteCapabilities', () => {
  it('maps skip-track mode', async () => {
    playbackSettingsStore.setState({ remoteControlMode: 'skip-track', skipForwardInterval: 15, skipBackwardInterval: 15 } as any);
    await updateRemoteCapabilities();
    expect(mockTP.setRemoteControls).toHaveBeenCalledWith({
      skipMode: 'track', forwardJumpInterval: 15, backwardJumpInterval: 15,
    });
  });
  it('maps skip-interval mode', async () => {
    playbackSettingsStore.setState({ remoteControlMode: 'skip-interval', skipForwardInterval: 30, skipBackwardInterval: 10 } as any);
    await updateRemoteCapabilities();
    expect(mockTP.setRemoteControls).toHaveBeenCalledWith({
      skipMode: 'interval', forwardJumpInterval: 30, backwardJumpInterval: 10,
    });
  });
});

describe('shuffleQueue', () => {
  it('does nothing with fewer than 2 tracks', async () => {
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.setQueue.mockClear();
    await shuffleQueue();
    expect(mockTP.setQueue).not.toHaveBeenCalled();
  });

  it('replaces the queue via setQueue(_, 0) and plays', async () => {
    const queue = Array.from({ length: 5 }, (_, i) => makeChild(`t${i}`));
    await playTrack(queue[0], queue);
    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    await shuffleQueue();
    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    expect(mockTP.setQueue.mock.calls[0][1]).toBe(0);
    expect(mockTP.play).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Event handlers (driven through the RNQP mock emitter)              */
/* ------------------------------------------------------------------ */

describe('onStateChange', () => {
  it('maps native states to PlaybackStatus', () => {
    emit('stateChange', 'playing');
    expect(mockSetPlaybackState).toHaveBeenCalledWith('playing');
    emit('stateChange', 'paused');
    expect(mockSetPlaybackState).toHaveBeenCalledWith('paused');
    emit('stateChange', 'buffering');
    expect(mockSetPlaybackState).toHaveBeenCalledWith('buffering');
    emit('stateChange', 'ended');
    expect(mockSetPlaybackState).toHaveBeenCalledWith('stopped');
    emit('stateChange', 'none');
    expect(mockSetPlaybackState).toHaveBeenCalledWith('idle');
  });

  it('clears error + retrying when transitioning to playing', () => {
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), error: 'boom', retrying: true,
    });
    emit('stateChange', 'playing');
    expect(mockSetError).toHaveBeenCalledWith(null);
    expect(mockSetRetrying).toHaveBeenCalledWith(false);
  });
});

describe('onProgress', () => {
  it('writes position/duration + absolute buffered edge (position + buffered-ahead)', () => {
    // RNQP `buffered` is seconds AHEAD of position; the store holds the absolute
    // edge. Background throttling of onProgress is native (configure), not here.
    emit('progress', { position: 12, duration: 200, buffered: 30 });
    expect(mockSetProgress).toHaveBeenCalledWith(12, 200, 42);
  });
});

describe('onTrackChange', () => {
  it('sets the current track + sends now-playing when resolved', async () => {
    const queue = [makeChild('t1'), makeChild('t2')];
    await playTrack(queue[0], queue);
    jest.clearAllMocks();
    emit('trackChange', { id: 't2' }, 1, 'auto-advance');
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }), 1);
    expect(sendNowPlaying).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }), undefined);
  });

  it('sets current track to null when track is empty', () => {
    emit('trackChange', undefined, -1, 'queue-replaced');
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(null, null);
  });
});

describe('playback-report scrobble', () => {
  // Reset the per-play guard to track index 0 (queue-replaced ⇒ no completion
  // scrobble), then clear mocks so each case starts from a known state.
  async function armPlay(trigger: number) {
    playbackSettingsStore.setState({ scrobbleTrigger: trigger } as any);
    const queue = [makeChild('t1'), makeChild('t2')];
    await playTrack(queue[0], queue);
    emit('trackChange', { id: 't1' }, 0, 'queue-replaced');
    jest.clearAllMocks();
  }

  it('scrobbles at exactly the configured milestone (default 50%)', async () => {
    await armPlay(50);
    emit('milestone', 50, 0);
    expect(addCompletedScrobble).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), undefined);
  });

  it('does not scrobble at other milestones', async () => {
    await armPlay(50);
    emit('milestone', 25, 0);
    emit('milestone', 75, 0);
    expect(addCompletedScrobble).not.toHaveBeenCalled();
  });

  it('reports exactly once per play (milestone, not again on later milestones or completion)', async () => {
    await armPlay(50);
    emit('milestone', 50, 0);
    emit('milestone', 75, 0);
    emit('milestone', 90, 0);
    emit('trackChange', { id: 't2' }, 1, 'auto-advance');
    expect(addCompletedScrobble).toHaveBeenCalledTimes(1);
  });

  it('completion fallback reports when the milestone was skipped by a seek', async () => {
    await armPlay(50);
    // The 50 milestone is consumed silently by a seek → never emitted; the track
    // then finishes and auto-advances.
    emit('trackChange', { id: 't2' }, 1, 'auto-advance');
    expect(addCompletedScrobble).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), undefined);
  });

  it('does not report on a user skip (not a natural completion)', async () => {
    await armPlay(50);
    emit('trackChange', { id: 't2' }, 1, 'user-skip-next');
    expect(addCompletedScrobble).not.toHaveBeenCalled();
  });

  it('trigger 100 reports only on completion, never on a milestone', async () => {
    await armPlay(100);
    emit('milestone', 25, 0);
    emit('milestone', 50, 0);
    emit('milestone', 90, 0);
    expect(addCompletedScrobble).not.toHaveBeenCalled();
    emit('trackChange', { id: 't2' }, 1, 'auto-advance');
    expect(addCompletedScrobble).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), undefined);
  });

  describe('after removing a track above the playing one', () => {
    // Queue t0, t1, t2 with t1 playing at index 1. Removing t0 moves t1 to index 0;
    // native reports that new index on later milestones and gives no track change.
    async function armMiddle(trigger: number) {
      playbackSettingsStore.setState({ scrobbleTrigger: trigger } as any);
      const queue = [makeChild('t0'), makeChild('t1'), makeChild('t2')];
      await playTrack(queue[1], queue);
      emit('trackChange', { id: 't1' }, 1, 'queue-replaced');
      jest.clearAllMocks();
    }

    it('does not scrobble the playing track a second time when it ends', async () => {
      await armMiddle(50);
      emit('milestone', 50, 1);
      mockTP.getCurrentTrackIndex.mockReturnValue(0);
      await removeFromQueue(0);
      emit('milestone', 75, 0);
      emit('trackChange', { id: 't2' }, 1, 'auto-advance');
      expect(addCompletedScrobble).toHaveBeenCalledTimes(1);
      expect(addCompletedScrobble).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), undefined);
    });

    it('scrobbles the playing track, not the next one, on completion (trigger 100)', async () => {
      await armMiddle(100);
      emit('milestone', 90, 1);
      mockTP.getCurrentTrackIndex.mockReturnValue(0);
      await removeFromQueue(0);
      emit('trackChange', { id: 't2' }, 1, 'auto-advance');
      expect(addCompletedScrobble).toHaveBeenCalledTimes(1);
      expect(addCompletedScrobble).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), undefined);
    });
  });

  it('re-scrobbles each repeat-one loop (milestone value wraps down)', async () => {
    await armPlay(50);
    emit('milestone', 50, 0); // loop 1
    emit('milestone', 90, 0);
    emit('milestone', 25, 0); // loop 2 begins → guard resets
    emit('milestone', 50, 0); // loop 2
    expect(addCompletedScrobble).toHaveBeenCalledTimes(2);
  });
});

describe('onError', () => {
  it('surfaces the error message', () => {
    emit('error', { message: 'Network error', fatal: false });
    expect(mockSetError).toHaveBeenCalledWith('Network error');
    expect(mockSetRetrying).toHaveBeenCalledWith(false);
  });

  it('falls back to a default message', () => {
    emit('error', { fatal: true });
    expect(mockSetError).toHaveBeenCalledWith('Playback error occurred');
  });
});

describe('onQueueEnd', () => {
  it('pins progress to the end of the current track', () => {
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(), currentTrack: makeChild('t1', { duration: 240 }),
    });
    emit('queueEnd');
    expect(mockSetProgress).toHaveBeenCalledWith(240, 240, 240);
  });

  it('no-ops when there is no current track', () => {
    emit('queueEnd');
    expect(mockSetProgress).not.toHaveBeenCalled();
  });
});

describe('applyLocalPlayToPlayer', () => {
  const now = '2026-07-03T10:00:00.000Z';

  it('updates playerStore.currentTrack when it is the scrobbled song', async () => {
    const track = makeChild('s1', { playCount: 7 });
    await playTrack(track, [track]);
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValueOnce({
      ...defaultPlayerState(), currentTrack: track,
    });
    applyLocalPlayToPlayer('s1', now);
    expect(mockPlayerStoreSetState).toHaveBeenCalledWith({
      currentTrack: { ...track, playCount: 8, played: now },
    });
  });

  it('does not update when a different song is scrobbled', async () => {
    const playing = makeChild('current');
    await playTrack(playing, [playing]);
    const { playerStore } = require('../../store/playerStore');
    (playerStore.getState as jest.Mock).mockReturnValueOnce({
      ...defaultPlayerState(), currentTrack: playing,
    });
    applyLocalPlayToPlayer('other', now);
    expect(mockPlayerStoreSetState).not.toHaveBeenCalled();
  });
});

describe('applyPlaybackMode', () => {
  afterEach(() => playbackSettingsStore.setState({ playbackMode: 'gapless', crossfadeDurationMs: 5000 } as any));

  it('sends gapless with no crossfade duration', async () => {
    playbackSettingsStore.setState({ playbackMode: 'gapless', crossfadeDurationMs: 5000 } as any);
    mockTP.setPlaybackMode.mockClear();
    await applyPlaybackMode();
    expect(mockTP.setPlaybackMode).toHaveBeenCalledWith({
      kind: 'gapless',
      crossfadeDurationMs: undefined,
    });
  });

  it('sends crossfade with the configured duration', async () => {
    playbackSettingsStore.setState({ playbackMode: 'crossfade', crossfadeDurationMs: 8000 } as any);
    mockTP.setPlaybackMode.mockClear();
    await applyPlaybackMode();
    expect(mockTP.setPlaybackMode).toHaveBeenCalledWith({
      kind: 'crossfade',
      crossfadeDurationMs: 8000,
    });
  });
});

describe('applyPitchCorrection', () => {
  afterEach(() => playbackSettingsStore.setState({ pitchCorrection: 'none' } as any));

  it('persists the mode and pushes it to the engine', async () => {
    mockTP.setPitchCorrectionMode.mockClear();
    await applyPitchCorrection('voice');
    expect(playbackSettingsStore.getState().pitchCorrection).toBe('voice');
    expect(mockTP.setPitchCorrectionMode).toHaveBeenCalledWith('voice');
  });
});

describe('applyReplayGain', () => {
  afterEach(() => playbackSettingsStore.setState({ replayGainMode: 'off' } as any));

  it('pushes the persisted mode to the engine', async () => {
    playbackSettingsStore.setState({ replayGainMode: 'album' } as any);
    mockTP.setReplayGainMode.mockClear();
    await applyReplayGain();
    expect(mockTP.setReplayGainMode).toHaveBeenCalledWith('album');
  });

  it('pushes off when disabled', async () => {
    playbackSettingsStore.setState({ replayGainMode: 'off' } as any);
    mockTP.setReplayGainMode.mockClear();
    await applyReplayGain();
    expect(mockTP.setReplayGainMode).toHaveBeenCalledWith('off');
  });
});

describe('equalizer wrappers', () => {
  const FLAT = new Array(10).fill(0);

  beforeEach(() => {
    equalizerSettingsStore.setState({ enabled: false, gains: FLAT.slice(), presetName: 'Flat' });
    Object.values(mockEq).forEach((fn) => typeof fn?.mockClear === 'function' && fn.mockClear());
  });

  it('applyEqualizerConfig re-applies persisted gains + enabled to the engine', async () => {
    equalizerSettingsStore.setState({ enabled: true, gains: [3, 0, 0, 0, 0, 0, 0, 0, 0, 3] });
    await applyEqualizerConfig();
    expect(mockEq.setAllBandGains).toHaveBeenCalledWith([3, 0, 0, 0, 0, 0, 0, 0, 0, 3]);
    expect(mockEq.setEnabled).toHaveBeenCalledWith(true);
  });

  it('setEqualizerEnabled persists + pushes to the engine', async () => {
    await setEqualizerEnabled(true);
    expect(equalizerSettingsStore.getState().enabled).toBe(true);
    expect(mockEq.setEnabled).toHaveBeenCalledWith(true);
  });

  it('applyEqualizerPreset loads the preset gains + name into store and engine', async () => {
    await applyEqualizerPreset('Rock');
    const rock = [5, 4, 3, 1, -1, -1, 2, 3, 4, 4];
    expect(equalizerSettingsStore.getState().gains).toEqual(rock);
    expect(equalizerSettingsStore.getState().presetName).toBe('Rock');
    expect(mockEq.setAllBandGains).toHaveBeenCalledWith(rock);
  });

  it('setEqualizerBandGain updates one band and flips the preset to Custom', async () => {
    await setEqualizerBandGain(2, 6);
    expect(equalizerSettingsStore.getState().gains[2]).toBe(6);
    expect(equalizerSettingsStore.getState().presetName).toBe(EQ_CUSTOM_PRESET_LABEL);
    expect(mockEq.setBandGain).toHaveBeenCalledWith(2, 6);
  });

  it('resetEqualizer restores flat gains + Flat preset and resets the engine', async () => {
    equalizerSettingsStore.setState({ gains: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], presetName: 'Custom' });
    await resetEqualizer();
    expect(equalizerSettingsStore.getState().gains).toEqual(FLAT);
    expect(equalizerSettingsStore.getState().presetName).toBe('Flat');
    expect(mockEq.reset).toHaveBeenCalled();
  });

  it('save/delete custom preset delegate to the engine', async () => {
    await saveEqualizerPreset('Mine');
    expect(mockEq.saveCustomPreset).toHaveBeenCalledWith('Mine');
    expect(equalizerSettingsStore.getState().presetName).toBe('Mine');
    await deleteEqualizerPreset('Mine');
    expect(mockEq.deleteCustomPreset).toHaveBeenCalledWith('Mine');
  });
});

describe('Radio Infinite primary seed on repeat-mode transitions', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { persistRadioSeed } = require('../queuePersistenceService');
  const { playerStore } = require('../../store/playerStore');

  beforeEach(() => {
    radioInfiniteSeedSession.clear();
  });

  it('captures the currently playing song when Radio is enabled', async () => {
    const queue = [
      makeChild('first'),
      makeChild('current'),
      makeChild('tail'),
    ];

    await playTrack(queue[1], queue);

    playerStore.getState.mockReturnValue({
      ...defaultPlayerState(),
      currentTrack: queue[1],
      currentTrackIndex: 1,
      queue,
    });

    playbackSettingsStore.setState({ repeatMode: 'one' });
    await cycleRepeatMode();

    const { seed } = radioInfiniteSeedSession.getSnapshot();

    expect(seed.primarySeedId).toBe('current');
    expect(seed.remainingRefills).toBeGreaterThanOrEqual(3);
    expect(seed.remainingRefills).toBeLessThanOrEqual(5);
    expect(persistRadioSeed).toHaveBeenLastCalledWith(seed);
  });

  it('waits for a playback selection when Radio is enabled with no current track', async () => {
    playbackSettingsStore.setState({ repeatMode: 'one' });
    await cycleRepeatMode();

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
  });

  it('clears the Primary when Radio is disabled', async () => {
    playbackSettingsStore.setState({ repeatMode: 'radio' });
    radioInfiniteSeedSession.reset('old-primary');

    await cycleRepeatMode();

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(persistRadioSeed).toHaveBeenLastCalledWith(null);
  });

  it('establishes a fresh Primary when Radio is re-enabled', async () => {
    playbackSettingsStore.setState({ repeatMode: 'radio' });
    radioInfiniteSeedSession.reset('old-primary');

    await cycleRepeatMode();

    playerStore.getState.mockReturnValue({
      ...defaultPlayerState(),
      currentTrack: makeChild('new-primary'),
      currentTrackIndex: 0,
      queue: [makeChild('new-primary')],
    });

    playbackSettingsStore.setState({ repeatMode: 'one' });
    await cycleRepeatMode();

    expect(
      radioInfiniteSeedSession.getSnapshot().seed.primarySeedId,
    ).toBe('new-primary');
  });

  it('clears the Primary when Offline Mode forces a fallback', () => {
    playbackSettingsStore.getState().setRepeatMode('radio');
    radioInfiniteSeedSession.reset('old-primary');

    mockSetOfflineMode(true);

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(persistRadioSeed).toHaveBeenLastCalledWith(null);
  });

  it('does not establish a Primary when Radio is rejected offline', () => {
    playerStore.getState.mockReturnValue({
      ...defaultPlayerState(),
      currentTrack: makeChild('current'),
      currentTrackIndex: 0,
      queue: [makeChild('current')],
    });

    mockSetOfflineMode(true);
    playbackSettingsStore.getState().setRepeatMode('radio');

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(persistRadioSeed).not.toHaveBeenCalledWith(
      expect.objectContaining({ primarySeedId: 'current' }),
    );
  });

  it('does not replace an existing Primary during settings hydration', () => {
    radioInfiniteSeedSession.restore({
      primarySeedId: 'persisted-primary',
      remainingRefills: 2,
    });

    playbackSettingsStore.setState({ repeatMode: 'radio' });

    expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual({
      primarySeedId: 'persisted-primary',
      remainingRefills: 2,
    });
    expect(persistRadioSeed).not.toHaveBeenCalled();
  });
});

describe('Radio Infinite primary seed during playback selection', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { persistRadioSeed } = require('../queuePersistenceService');
  const {
    isRadioQueueTransitionActive,
    requestRadioInfiniteRefill,
  } = require('../radioInfiniteDispatcher');

  beforeEach(() => {
    radioInfiniteSeedSession.clear();
    playbackSettingsStore.getState().setRepeatMode('radio');
    jest.clearAllMocks();
  });

  it('uses the selected album track rather than the queue tail', async () => {
    const queue = [
      makeChild('first'),
      makeChild('selected'),
      makeChild('last'),
    ];

    await playTrack(queue[1], queue);

    const { seed } = radioInfiniteSeedSession.getSnapshot();

    expect(seed.primarySeedId).toBe('selected');
    expect(seed.remainingRefills).toBeGreaterThanOrEqual(3);
    expect(seed.remainingRefills).toBeLessThanOrEqual(5);
    expect(persistRadioSeed).toHaveBeenLastCalledWith(seed);
  });

  it('replaces the previous Primary on a new playback selection', async () => {
    radioInfiniteSeedSession.restore({
      primarySeedId: 'old-primary',
      remainingRefills: 1,
    });

    await playTrack(makeChild('new-primary'), [makeChild('new-primary')]);

    const { seed } = radioInfiniteSeedSession.getSnapshot();

    expect(seed.primarySeedId).toBe('new-primary');
    expect(seed.remainingRefills).toBeGreaterThanOrEqual(3);
    expect(seed.remainingRefills).toBeLessThanOrEqual(5);
  });

  it('invalidates outstanding refill accounting before native queue replacement', async () => {
    radioInfiniteSeedSession.restore({
      primarySeedId: 'old-primary',
      remainingRefills: 1,
    });

    const { generation } = radioInfiniteSeedSession.getSnapshot();

    mockTP.setQueue.mockImplementationOnce(async () => {
      expect(isRadioQueueTransitionActive()).toBe(true);

      expect(
        radioInfiniteSeedSession.completeRefill(generation, ['stale']),
      ).toBe(false);
    });

    await playTrack(makeChild('new-primary'), [makeChild('new-primary')]);

    expect(isRadioQueueTransitionActive()).toBe(false);
    expect(
      radioInfiniteSeedSession.getSnapshot().seed.primarySeedId,
    ).toBe('new-primary');
  });

  it('suppresses track-change replenishment during native queue replacement', async () => {
    const track = makeChild('selected');

    mockTP.setQueue.mockImplementationOnce(async () => {
      expect(isRadioQueueTransitionActive()).toBe(true);

      emit('trackChange', { id: track.id }, 0, 'queue-replaced');

      expect(requestRadioInfiniteRefill).not.toHaveBeenCalled();
    });

    await playTrack(track, [track]);

    expect(isRadioQueueTransitionActive()).toBe(false);
    expect(requestRadioInfiniteRefill).toHaveBeenCalledTimes(1);
  });

  it('retains the previous musical context if native queue replacement rejects', async () => {
    const previous = {
      primarySeedId: 'old-primary',
      remainingRefills: 2,
    };

    radioInfiniteSeedSession.restore(previous);
    mockTP.setQueue.mockRejectedValueOnce(new Error('Queue replacement failed'));

    await playTrack(makeChild('new-primary'), [makeChild('new-primary')]);

    expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual(previous);
    expect(isRadioQueueTransitionActive()).toBe(false);
    expect(requestRadioInfiniteRefill).not.toHaveBeenCalled();

    const { canRefillRadioInfinite } = require('../radioInfiniteDispatcher');
    expect(canRefillRadioInfinite()).toBe(false);
  });

  it('retains the new Primary if playback fails after queue replacement', async () => {
    mockTP.play.mockRejectedValueOnce(new Error('Playback failed'));

    await playTrack(makeChild('new-primary'), [makeChild('new-primary')]);

    expect(
      radioInfiniteSeedSession.getSnapshot().seed.primarySeedId,
    ).toBe('new-primary');

    expect(isRadioQueueTransitionActive()).toBe(false);

    const { canRefillRadioInfinite } = require('../radioInfiniteDispatcher');
    expect(canRefillRadioInfinite()).toBe(true);
  });

  it('preserves the Primary and lifespan during ordinary queue navigation', async () => {
    const queue = [makeChild('first'), makeChild('second')];
    await playTrack(queue[0], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();

    await skipToNext();
    await skipToPrevious();
    await skipToTrack(1);

    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
  });

  it('discards musical context when the queue is cleared', async () => {
    await playTrack(makeChild('primary'), [makeChild('primary')]);

    await clearQueue();

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(isRadioQueueTransitionActive()).toBe(false);
    expect(mockClearPersistedQueue).toHaveBeenCalled();
  });

  it('does not establish a Primary during ordinary non-Radio playback', async () => {
    playbackSettingsStore.getState().setRepeatMode('off');

    await playTrack(makeChild('ordinary'), [makeChild('ordinary')]);

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(requestRadioInfiniteRefill).not.toHaveBeenCalled();
  });
});

describe('Radio Infinite playable-track fallback', () => {
  it('uses the actual playable starting song when the selected song is unavailable', async () => {
    const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');

    playbackSettingsStore.getState().setRepeatMode('radio');

    const unavailable = makeChild('unavailable');
    const playable = makeChild('playable');

    (getStreamUrl as jest.Mock).mockImplementation((id: string) =>
      id === 'unavailable'
        ? null
        : 'https://example.com/stream.mp3',
    );

    await playTrack(unavailable, [unavailable, playable]);

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);

    const [tracks, startIndex] = mockTP.setQueue.mock.calls[0];

    expect(tracks.map((track: { id: string }) => track.id)).toEqual([
      'playable',
    ]);
    expect(startIndex).toBe(0);

    expect(
      radioInfiniteSeedSession.getSnapshot().seed?.primarySeedId,
    ).toBe('playable');
  });
});

describe('Radio Infinite queue clearing failure', () => {
  it('discards musical context and persisted state even when native clearing fails', async () => {
    const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
    const {
      isRadioQueueTransitionActive,
    } = require('../radioInfiniteDispatcher');

    playbackSettingsStore.getState().setRepeatMode('radio');

    const track = makeChild('primary');
    await playTrack(track, [track]);

    expect(
      radioInfiniteSeedSession.getSnapshot().seed?.primarySeedId,
    ).toBe('primary');

    mockClearPersistedQueue.mockClear();
    mockSetQueue.mockClear();
    mockSetCurrentTrack.mockClear();

    mockTP.clearQueue.mockRejectedValueOnce(
      new Error('Native queue clearing failed'),
    );

    await expect(clearQueue()).rejects.toThrow(
      'Native queue clearing failed',
    );

    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(mockClearPersistedQueue).toHaveBeenCalledTimes(1);
    expect(mockSetQueue).toHaveBeenCalledWith([]);
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(null);
    expect(isRadioQueueTransitionActive()).toBe(false);

    const { canRefillRadioInfinite } = require('../radioInfiniteDispatcher');
    expect(canRefillRadioInfinite()).toBe(false);
  });
});

describe('Radio Infinite musical context preservation', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { requestRadioInfiniteRefill } = require('../radioInfiniteDispatcher');
  const { playerStore } = require('../../store/playerStore');

  beforeEach(() => {
    playbackSettingsStore.getState().setRepeatMode('radio');
  });

  it('requests replenishment on ordinary track advancement without replacing the Primary', async () => {
    const queue = [makeChild('primary'), makeChild('next')];
    await playTrack(queue[0], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();
    requestRadioInfiniteRefill.mockClear();

    emit('trackChange', { id: 'next' }, 1, 'auto-advance');

    expect(requestRadioInfiniteRefill).toHaveBeenCalledTimes(1);
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
  });

  it('preserves the Primary and remaining lifespan during server failover', async () => {
    const queue = [makeChild('primary'), makeChild('current')];
    await playTrack(queue[0], queue);

    const { generation } = radioInfiniteSeedSession.getSnapshot();
    radioInfiniteSeedSession.completeRefill(generation, ['recommendation']);

    const previous = radioInfiniteSeedSession.getSnapshot();
    const { getRadioQueueRevision } = require('../radioInfiniteDispatcher');
    const previousRevision = getRadioQueueRevision();

    (playerStore.getState as jest.Mock).mockReturnValue({
      ...playerStore.getState(),
      queue,
      currentTrack: queue[1],
      currentTrackIndex: 1,
      position: 42,
      playbackState: 'playing',
    });

    mockTP.setQueue.mockClear();

    await rebuildQueueForServerSwitch();

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    expect(mockTP.setQueue.mock.calls[0][1]).toBe(1);
    expect(mockTP.seekTo).toHaveBeenCalledWith(42);
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(getRadioQueueRevision()).toBe(previousRevision + 1);
  });

  it('establishes the selected playlist song as Primary and preserves playlist provenance', async () => {
    const queue = [
      makeChild('first'),
      makeChild('selected'),
      makeChild('last'),
    ];

    await playTrack(queue[1], queue, 'playlist-123');

    expect(
      radioInfiniteSeedSession.getSnapshot().seed?.primarySeedId,
    ).toBe('selected');

    emit('trackChange', { id: 'last' }, 2, 'auto-advance');

    expect(sendNowPlaying).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'last' }),
      'playlist-123',
    );

    expect(
      radioInfiniteSeedSession.getSnapshot().seed?.primarySeedId,
    ).toBe('selected');
  });
});

describe('Radio Infinite unsuccessful server failover', () => {
  it('preserves musical context when no tracks can be resolved against the new server', async () => {
    const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');

    playbackSettingsStore.getState().setRepeatMode('radio');

    const queue = [makeChild('primary'), makeChild('next')];
    await playTrack(queue[0], queue);

    const { generation } = radioInfiniteSeedSession.getSnapshot();
    radioInfiniteSeedSession.completeRefill(generation, ['recommendation']);

    const previous = radioInfiniteSeedSession.getSnapshot();
    const { getRadioQueueRevision } = require('../radioInfiniteDispatcher');
    const previousRevision = getRadioQueueRevision();

    mockTP.setQueue.mockClear();

    (getStreamUrl as jest.Mock).mockReturnValue(null);

    await rebuildQueueForServerSwitch();

    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(getRadioQueueRevision()).toBe(previousRevision + 1);
  });
});

describe('Radio Infinite guarded append', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { persistRadioSeed } = require('../queuePersistenceService');
  const dispatcher = require('../radioInfiniteDispatcher');

  beforeEach(async () => {
    playbackSettingsStore.getState().setRepeatMode('radio');

    const queue = [makeChild('primary'), makeChild('tail')];
    await playTrack(queue[0], queue);

    radioInfiniteSeedSession.restore({
      primarySeedId: 'primary',
      remainingRefills: 3,
    });

    jest.clearAllMocks();
  });

  function append(tracks: Child[]): Promise<Child[]> {
    const { generation } = radioInfiniteSeedSession.getSnapshot();
    const revision = dispatcher.getRadioQueueRevision();

    return appendRadioInfiniteRecommendations(
      tracks,
      generation,
      () =>
        dispatcher.getRadioQueueRevision() === revision &&
        radioInfiniteSeedSession.getSnapshot().generation === generation &&
        playbackSettingsStore.getState().repeatMode === 'radio',
    );
  }

  it('counts a successful batch as exactly one refill', async () => {
    const tracks = [makeChild('a'), makeChild('b'), makeChild('c')];

    await expect(append(tracks)).resolves.toEqual(tracks);

    expect(mockTP.addToQueue).toHaveBeenCalledTimes(1);
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();

    expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual({
      primarySeedId: 'primary',
      remainingRefills: 2,
    });

    expect(persistRadioSeed).toHaveBeenLastCalledWith({
      primarySeedId: 'primary',
      remainingRefills: 2,
    });

    expect(mockPersistQueue).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({ id: 'primary' }),
        expect.objectContaining({ id: 'tail' }),
        ...tracks,
      ],
      expect.any(Number),
    );
  });

  it('rotates to the first actually appended playable recommendation', async () => {
    radioInfiniteSeedSession.restore({
      primarySeedId: 'primary',
      remainingRefills: 1,
    });

    (getStreamUrl as jest.Mock).mockImplementation(
      (id: string) =>
        id === 'unplayable' ? null : 'https://example.com/stream.mp3',
    );

    const playable = makeChild('playable');

    await expect(
      append([makeChild('unplayable'), playable, makeChild('later')]),
    ).resolves.toEqual([playable, makeChild('later')]);

    const { seed } = radioInfiniteSeedSession.getSnapshot();

    expect(seed.primarySeedId).toBe('playable');
    expect(seed.remainingRefills).toBeGreaterThanOrEqual(3);
    expect(seed.remainingRefills).toBeLessThanOrEqual(5);
    expect(persistRadioSeed).toHaveBeenLastCalledWith(seed);
  });

  it('does not consume lifespan for an empty recommendation batch', async () => {
    const previous = radioInfiniteSeedSession.getSnapshot();

    await expect(append([])).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();
    expect(persistRadioSeed).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
  });

  it('does not consume lifespan when no recommendations are playable', async () => {
    const previous = radioInfiniteSeedSession.getSnapshot();

    (getStreamUrl as jest.Mock).mockReturnValue(null);

    await expect(append([makeChild('unplayable')])).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();
    expect(persistRadioSeed).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
  });

  it('rejects an already stale recommendation context', async () => {
    const { generation } = radioInfiniteSeedSession.getSnapshot();

    await expect(
      appendRadioInfiniteRecommendations(
        [makeChild('stale')],
        generation,
        () => false,
      ),
    ).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();
    expect(persistRadioSeed).not.toHaveBeenCalled();
  });

  it('never starts playback when the queue is empty', async () => {
    await clearQueue();
    jest.clearAllMocks();

    await expect(append([makeChild('recommendation')])).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
    expect(persistRadioSeed).not.toHaveBeenCalled();
  });

  it('preserves lifespan and marks the queue uncertain after native failure', async () => {
    const previous = radioInfiniteSeedSession.getSnapshot();

    mockTP.addToQueue.mockRejectedValueOnce(new Error('Native append failed'));

    await expect(append([makeChild('recommendation')]))
      .rejects.toThrow('Native append failed');

    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(persistRadioSeed).not.toHaveBeenCalled();
    expect(mockPersistQueue).not.toHaveBeenCalled();
    expect(dispatcher.canRefillRadioInfinite()).toBe(false);
  });

  it('suppresses further appends until a successful full replacement', async () => {
    dispatcher.markRadioQueueUncertain();

    await expect(append([makeChild('blocked')])).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();

    const replacement = makeChild('replacement');
    await playTrack(replacement, [replacement]);

    expect(dispatcher.canRefillRadioInfinite()).toBe(true);

    const recommendation = makeChild('accepted');

    await expect(append([recommendation])).resolves.toEqual([recommendation]);

    expect(mockTP.addToQueue).toHaveBeenCalledTimes(1);
  });
});

describe('Radio Infinite native append races', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { persistRadioSeed } = require('../queuePersistenceService');
  const dispatcher = require('../radioInfiniteDispatcher');

  function deferred() {
    let resolve!: () => void;

    const promise = new Promise<void>((done) => {
      resolve = done;
    });

    return { promise, resolve };
  }

  beforeEach(async () => {
    playbackSettingsStore.getState().setRepeatMode('radio');

    const queue = [makeChild('primary'), makeChild('tail')];
    await playTrack(queue[0], queue);

    radioInfiniteSeedSession.restore({
      primarySeedId: 'primary',
      remainingRefills: 3,
    });

    jest.clearAllMocks();
  });

  function startPendingAppend() {
    const entered = deferred();
    const release = deferred();

    mockTP.addToQueue.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });

    const { generation } = radioInfiniteSeedSession.getSnapshot();
    const revision = dispatcher.getRadioQueueRevision();

    const append = appendRadioInfiniteRecommendations(
      [makeChild('recommendation')],
      generation,
      () =>
        dispatcher.getRadioQueueRevision() === revision &&
        radioInfiniteSeedSession.getSnapshot().generation === generation &&
        playbackSettingsStore.getState().repeatMode === 'radio',
    );

    return { entered, release, append };
  }

  it('accounts for a completed refill before a waiting shuffle proceeds', async () => {
    const pending = startPendingAppend();

    await pending.entered.promise;

    const shuffle = shuffleQueue();

    try {
      expect(dispatcher.canRefillRadioInfinite()).toBe(false);
      expect(mockTP.setQueue).not.toHaveBeenCalled();

      expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual({
        primarySeedId: 'primary',
        remainingRefills: 3,
      });

      mockTP.setQueue.mockImplementationOnce(async () => {
        expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual({
          primarySeedId: 'primary',
          remainingRefills: 2,
        });

        expect(persistRadioSeed).toHaveBeenLastCalledWith({
          primarySeedId: 'primary',
          remainingRefills: 2,
        });
      });
    } finally {
      pending.release.resolve();
    }

    await pending.append;
    await shuffle;

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);

    const nativeTracks = mockTP.setQueue.mock.calls[0][0];

    expect(nativeTracks.map((track: { id: string }) => track.id).sort())
      .toEqual(['primary', 'recommendation', 'tail']);

    expect(radioInfiniteSeedSession.getSnapshot().seed).toEqual({
      primarySeedId: 'primary',
      remainingRefills: 2,
    });

    expect(dispatcher.canRefillRadioInfinite()).toBe(true);
  });

  it('finishes the old native append before replacing the playback queue', async () => {
    const pending = startPendingAppend();

    await pending.entered.promise;

    const replacement = makeChild('new-primary');
    const selection = playTrack(replacement, [replacement]);

    try {
      expect(mockTP.setQueue).not.toHaveBeenCalled();
      expect(dispatcher.canRefillRadioInfinite()).toBe(false);
    } finally {
      pending.release.resolve();
    }

    await pending.append;
    await selection;

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);

    expect(mockTP.setQueue.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'new-primary' }),
    ]);

    expect(radioInfiniteSeedSession.getSnapshot().seed.primarySeedId)
      .toBe('new-primary');

    expect(mockPersistQueue).toHaveBeenLastCalledWith([replacement], 0);

    expect(persistRadioSeed).toHaveBeenCalledTimes(1);
    expect(dispatcher.canRefillRadioInfinite()).toBe(true);
  });

  it('finishes an active native append before clearing the queue', async () => {
    const pending = startPendingAppend();

    await pending.entered.promise;

    const clearing = clearQueue();

    try {
      expect(mockTP.clearQueue).not.toHaveBeenCalled();
      expect(dispatcher.canRefillRadioInfinite()).toBe(false);
    } finally {
      pending.release.resolve();
    }

    await pending.append;
    await clearing;

    expect(mockTP.clearQueue).toHaveBeenCalledTimes(1);
    expect(mockClearPersistedQueue).toHaveBeenCalledTimes(1);
    expect(mockSetQueue).toHaveBeenLastCalledWith([]);
    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
    expect(persistRadioSeed).not.toHaveBeenCalled();
    expect(dispatcher.canRefillRadioInfinite()).toBe(true);
  });

  it('discards recommendations when the queue changes during preparation', async () => {
    const { waitForTrackMapsReady } = require('../musicCacheService');

    const entered = deferred();
    const release = deferred();

    waitForTrackMapsReady.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });

    const { generation } = radioInfiniteSeedSession.getSnapshot();
    const revision = dispatcher.getRadioQueueRevision();

    const append = appendRadioInfiniteRecommendations(
      [makeChild('stale')],
      generation,
      () => dispatcher.getRadioQueueRevision() === revision,
    );

    await entered.promise;

    try {
      await clearQueue();
    } finally {
      release.resolve();
    }

    await expect(append).resolves.toEqual([]);

    expect(mockTP.addToQueue).not.toHaveBeenCalled();
    expect(mockTP.setQueue).not.toHaveBeenCalled();
    expect(mockTP.play).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot().seed).toBeNull();
  });
});

describe('Radio Infinite replacement synchronization', () => {
  const { radioInfiniteSeedSession } = require('../radioInfiniteSeed');
  const { canRefillRadioInfinite } = require('../radioInfiniteDispatcher');
  const { playerStore } = require('../../store/playerStore');

  beforeEach(() => {
    playbackSettingsStore.getState().setRepeatMode('radio');
  });

  it('publishes the replacement queue even when failover resume seek fails', async () => {
    const queue = [
      makeChild('primary'),
      makeChild('current'),
      makeChild('unavailable'),
    ];

    await playTrack(queue[1], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();

    (playerStore.getState as jest.Mock).mockReturnValue({
      ...defaultPlayerState(),
      queue,
      currentTrack: queue[1],
      currentTrackIndex: 1,
      position: 42,
      playbackState: 'playing',
    });

    (getStreamUrl as jest.Mock).mockImplementation((id: string) =>
      id === 'unavailable'
        ? null
        : `https://secondary.example.com/stream/${id}`,
    );

    mockTP.setQueue.mockClear();
    mockTP.play.mockClear();
    mockPersistQueue.mockClear();
    mockSetQueue.mockClear();

    mockTP.seekTo.mockRejectedValueOnce(new Error('Resume seek failed'));

    await rebuildQueueForServerSwitch();

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);

    const [tracks, index] = mockTP.setQueue.mock.calls[0];

    expect(tracks.map((track: { id: string }) => track.id))
      .toEqual(['primary', 'current']);
    expect(index).toBe(1);

    expect(mockSetQueue).toHaveBeenLastCalledWith(queue.slice(0, 2));
    expect(mockPersistQueue).toHaveBeenLastCalledWith(queue.slice(0, 2), 1);

    expect(mockTP.seekTo).toHaveBeenCalledWith(42);
    expect(mockTP.play).not.toHaveBeenCalled();

    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(canRefillRadioInfinite()).toBe(true);
  });

  it('marks the queue uncertain when native failover replacement fails', async () => {
    const queue = [makeChild('primary'), makeChild('next')];

    await playTrack(queue[0], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();

    mockPersistQueue.mockClear();

    mockTP.setQueue.mockRejectedValueOnce(
      new Error('Native failover replacement failed'),
    );

    await rebuildQueueForServerSwitch();

    expect(mockPersistQueue).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(canRefillRadioInfinite()).toBe(false);
  });

  it('persists the shuffled order even when subsequent playback fails', async () => {
    const queue = [
      makeChild('primary'),
      makeChild('second'),
      makeChild('third'),
    ];

    await playTrack(queue[0], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();

    mockTP.setQueue.mockClear();
    mockPersistQueue.mockClear();

    mockTP.play.mockRejectedValueOnce(new Error('Shuffle playback failed'));

    await shuffleQueue();

    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    expect(mockPersistQueue).toHaveBeenCalledTimes(1);

    const [nativeTracks, nativeIndex] = mockTP.setQueue.mock.calls[0];
    const [persistedTracks, persistedIndex] = mockPersistQueue.mock.calls[0];

    expect(persistedTracks.map((track: Child) => track.id))
      .toEqual(nativeTracks.map((track: { id: string }) => track.id));

    expect(persistedIndex).toBe(nativeIndex);
    expect(persistedIndex).toBe(0);

    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(canRefillRadioInfinite()).toBe(true);
  });

  it('marks the queue uncertain when native shuffle replacement fails', async () => {
    const queue = [makeChild('primary'), makeChild('next')];

    await playTrack(queue[0], queue);

    const previous = radioInfiniteSeedSession.getSnapshot();

    mockPersistQueue.mockClear();

    mockTP.setQueue.mockRejectedValueOnce(
      new Error('Native shuffle replacement failed'),
    );

    await shuffleQueue();

    expect(mockPersistQueue).not.toHaveBeenCalled();
    expect(radioInfiniteSeedSession.getSnapshot()).toEqual(previous);
    expect(canRefillRadioInfinite()).toBe(false);
  });
});
