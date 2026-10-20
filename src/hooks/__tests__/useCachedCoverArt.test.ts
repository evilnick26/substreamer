/**
 * useCachedCoverArt resolves through the one cover resolver: a song (coverArt + albumId)
 * gets its album's cover in album mode, a miss triggers caching of the RESOLVED cover, and a
 * landed file or an offline flip re-resolves.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockResolve = jest.fn();
const mockEnsureCached = jest.fn((_id: string) => Promise.resolve());
let mockListener: (() => void) | null = null;
let mockSubscribedId: string | null = null;
jest.mock('../../services/imageCacheService', () => ({
  resolveDisplayImage: (...a: unknown[]) => mockResolve(...a),
  ensureCached: (id: string) => mockEnsureCached(id),
  subscribeImageCacheUpdate: (id: string, l: () => void) => {
    mockSubscribedId = id;
    mockListener = l;
    return () => { mockListener = null; };
  },
}));

import { offlineModeStore } from '../../store/offlineModeStore';
import { useCachedCoverArt } from '../useCachedCoverArt';

beforeEach(() => {
  mockResolve.mockReset();
  mockEnsureCached.mockClear();
  mockListener = null;
  mockSubscribedId = null;
  offlineModeStore.setState({ offlineMode: false });
});

it("resolves a song through its album and caches the album's cover on a miss", async () => {
  mockResolve.mockResolvedValue({ coverArtId: 'al-1_h', uri: 'https://srv/al-1_h', isRemote: true });

  const { result } = renderHook(() => useCachedCoverArt('dc-1', 300, 'alb1'));

  await waitFor(() => expect(result.current).toBe('https://srv/al-1_h'));
  expect(mockResolve).toHaveBeenCalledWith({ coverArt: 'dc-1', albumId: 'alb1' }, 300, { offline: false });
  expect(mockEnsureCached).toHaveBeenCalledWith('al-1_h');
  expect(mockSubscribedId).toBe('al-1_h');
});

it('does not re-cache a cover already on disk, and re-resolves when a file lands', async () => {
  mockResolve.mockResolvedValue({ coverArtId: 'ar-1', uri: 'file:///c/ar-1/300.jpg', isRemote: false });
  const { result } = renderHook(() => useCachedCoverArt('ar-1', 300));
  await waitFor(() => expect(result.current).toBe('file:///c/ar-1/300.jpg'));
  expect(mockEnsureCached).not.toHaveBeenCalled();

  mockResolve.mockResolvedValue({ coverArtId: 'ar-1', uri: 'file:///c/ar-1/300.webp', isRemote: false });
  await act(async () => { mockListener?.(); });
  await waitFor(() => expect(result.current).toBe('file:///c/ar-1/300.webp'));
});

it('re-resolves on an offline flip', async () => {
  mockResolve.mockResolvedValue({ coverArtId: 'ar-1', uri: 'https://srv/ar-1', isRemote: true });
  const { result } = renderHook(() => useCachedCoverArt('ar-1', 300));
  await waitFor(() => expect(result.current).toBe('https://srv/ar-1'));

  mockResolve.mockResolvedValue({ coverArtId: 'ar-1', uri: null, isRemote: false });
  await act(async () => { offlineModeStore.setState({ offlineMode: true }); });
  await waitFor(() => expect(result.current).toBeNull());
  expect(mockResolve).toHaveBeenLastCalledWith({ coverArt: 'ar-1', albumId: undefined }, 300, { offline: true });
});

it('immediately hides the previous URI when the artwork request changes', async () => {
  mockResolve.mockImplementation(({ coverArt }: { coverArt: string }) =>
    Promise.resolve({ coverArtId: coverArt, uri: `file:///covers/${coverArt}.jpg`, isRemote: false }),
  );
  const { result, rerender } = renderHook(
    ({ cover, album }: { cover: string; album: string }) => useCachedCoverArt(cover, 300, album),
    { initialProps: { cover: 'track-a', album: 'album-a' } },
  );
  await waitFor(() => expect(result.current).toBe('file:///covers/track-a.jpg'));

  rerender({ cover: 'track-b', album: 'album-b' });
  // This assertion runs before the new asynchronous resolver can publish B.
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).toBe('file:///covers/track-b.jpg'));
});

it('ignores an old artwork resolution that finishes after the new track', async () => {
  let finishOld!: (value: { coverArtId: string; uri: string; isRemote: boolean }) => void;
  mockResolve.mockImplementation(({ coverArt }: { coverArt: string }) => {
    if (coverArt === 'track-a') {
      return new Promise((resolve) => { finishOld = resolve; });
    }
    return Promise.resolve({ coverArtId: 'track-b', uri: 'file:///covers/b.jpg', isRemote: false });
  });
  const { result, rerender } = renderHook(
    ({ cover }: { cover: string }) => useCachedCoverArt(cover, 300),
    { initialProps: { cover: 'track-a' } },
  );
  expect(result.current).toBeNull();
  rerender({ cover: 'track-b' });
  await waitFor(() => expect(result.current).toBe('file:///covers/b.jpg'));

  await act(async () => {
    finishOld({ coverArtId: 'track-a', uri: 'file:///covers/a.jpg', isRemote: false });
  });
  expect(result.current).toBe('file:///covers/b.jpg');
  expect(mockSubscribedId).toBe('track-b');
});

it('does not reuse a URI when only the album identity changes', async () => {
  mockResolve.mockImplementation(({ albumId }: { albumId: string }) =>
    Promise.resolve({ coverArtId: albumId, uri: `file:///albums/${albumId}.jpg`, isRemote: false }),
  );
  const { result, rerender } = renderHook(
    ({ album }: { album: string }) => useCachedCoverArt('shared-song-cover', 300, album),
    { initialProps: { album: 'album-a' } },
  );
  await waitFor(() => expect(result.current).toBe('file:///albums/album-a.jpg'));
  rerender({ album: 'album-b' });
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).toBe('file:///albums/album-b.jpg'));
});

it('returns null without resolving when there is no cover', async () => {
  const { result } = renderHook(() => useCachedCoverArt(undefined, 300));
  expect(result.current).toBeNull();
  expect(mockResolve).not.toHaveBeenCalled();
});
