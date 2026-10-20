import { act, render, waitFor } from '@testing-library/react-native';
import { useSyncExternalStore } from 'react';
import type { Palette } from 'expo-image-colors';
import { clearArtworkPaletteCacheForTests } from '../../services/artworkPaletteService';

const mockGetPalette = jest.fn<Promise<Palette | null>, [string]>();
jest.mock('expo-image-colors', () => ({
  getImagePaletteAsync: (uri: string) => mockGetPalette(uri),
}));

const mockConstants = { appOwnership: null as string | null };
jest.mock('expo-constants', () => ({
  __esModule: true,
  get default() { return mockConstants; },
}));

const mockUseCachedCoverArt = jest.fn();
jest.mock('../../hooks/useCachedCoverArt', () => ({
  useCachedCoverArt: (...args: unknown[]) => mockUseCachedCoverArt(...args),
}));

// Minimal callable store implementing the Zustand API used by the controller.
// Using React's subscription primitive avoids Jest's hoisting/automock issues.
function makeMockStore<S extends object>(initial: S) {
  let state = initial;
  const listeners = new Set<() => void>();
  const getState = () => state;
  const setState = (patch: Partial<S>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const store = Object.assign(
    <T,>(selector: (value: S) => T): T =>
      useSyncExternalStore(subscribe, () => selector(getState())),
    { getState, setState, subscribe },
  );
  return store;
}

type MockAccent = { coverKey: string; palette: { dark: string; light: string } | null } | null;
const mockThemeStore = makeMockStore<{
  primaryColor: string | null;
  artworkAccent: MockAccent;
  setArtworkAccent: (value: MockAccent) => void;
}>({
  primaryColor: null,
  artworkAccent: null,
  setArtworkAccent: (artworkAccent) => mockThemeStore.setState({ artworkAccent }),
});
jest.mock('../../store/themeStore', () => ({
  ARTWORK_PRIMARY_COLOR: 'artwork',
  get themeStore() { return mockThemeStore; },
}));

const mockPlayerStore = makeMockStore<{
  currentTrack: { coverArt?: string; albumId?: string } | null;
}>({ currentTrack: null });
jest.mock('../../store/playerStore', () => ({ get playerStore() { return mockPlayerStore; } }));

import { ArtworkAccentController } from '../ArtworkAccentController';


const PALETTE: Palette = {
  dark: { primary: '#123456', secondary: null },
  light: { primary: '#abcdef', secondary: null },
};

beforeEach(() => {
  clearArtworkPaletteCacheForTests();
  mockGetPalette.mockReset();
  mockConstants.appOwnership = null;
  mockUseCachedCoverArt.mockReset();
  mockUseCachedCoverArt.mockImplementation((cover: string | undefined) =>
    cover ? `file:///covers/${cover}.jpg` : null,
  );
  act(() => {
    mockThemeStore.setState({ primaryColor: null, artworkAccent: null });
    mockPlayerStore.setState({ currentTrack: null });
  });
});

it('does not extract when Blue or a static accent is selected', async () => {
  mockGetPalette.mockResolvedValue(PALETTE);
  act(() => mockPlayerStore.setState({ currentTrack: { coverArt: 'a', albumId: '1' } }));
  const screen = render(<ArtworkAccentController />);
  await act(async () => {});
  expect(mockGetPalette).not.toHaveBeenCalled();
  act(() => mockThemeStore.setState({ primaryColor: '#E91429' }));
  screen.rerender(<ArtworkAccentController />);
  expect(mockGetPalette).not.toHaveBeenCalled();
  expect(mockUseCachedCoverArt).toHaveBeenLastCalledWith(undefined, 300, undefined);
});

it('re-extracts when the resolved artwork URI changes', async () => {
  mockGetPalette.mockResolvedValue(PALETTE);
  act(() => {
    mockThemeStore.setState({ primaryColor: 'artwork' });
    mockPlayerStore.setState({ currentTrack: { coverArt: 'a', albumId: '1' } });
  });
  const screen = render(<ArtworkAccentController />);
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent).toEqual({
    coverKey: 'a|1', palette: { dark: '#123456', light: '#abcdef' },
  }));
  mockUseCachedCoverArt.mockReturnValue('file:///covers/a-new.jpg');
  screen.rerender(<ArtworkAccentController />);
  await waitFor(() => expect(mockGetPalette).toHaveBeenCalledWith('file:///covers/a-new.jpg'));
  expect(mockGetPalette).toHaveBeenCalledTimes(2);
});

it('falls back after a failed extraction and does not repeatedly retry it', async () => {
  mockGetPalette.mockRejectedValue(new Error('decode failed'));
  act(() => {
    mockThemeStore.setState({ primaryColor: 'artwork' });
    mockPlayerStore.setState({ currentTrack: { coverArt: 'bad', albumId: '2' } });
  });
  const screen = render(<ArtworkAccentController />);
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent).toEqual({
    coverKey: 'bad|2', palette: null,
  }));
  screen.rerender(<ArtworkAccentController />);
  await act(async () => {});
  expect(mockGetPalette).toHaveBeenCalledTimes(1);
});

it('clears runtime accent when static colour is selected or artwork disappears', async () => {
  mockGetPalette.mockResolvedValue(PALETTE);
  act(() => {
    mockThemeStore.setState({ primaryColor: 'artwork' });
    mockPlayerStore.setState({ currentTrack: { coverArt: 'a' } });
  });
  render(<ArtworkAccentController />);
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent?.palette).not.toBeNull());
  act(() => mockThemeStore.setState({ primaryColor: null }));
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent).toBeNull());
  act(() => mockThemeStore.setState({ primaryColor: 'artwork' }));
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent?.coverKey).toBe('a|'));
  act(() => mockPlayerStore.setState({ currentTrack: null }));
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent).toBeNull());
});

it('does not publish an obsolete cover result after the track changes', async () => {
  let resolveOld!: (value: Palette | null) => void;
  mockGetPalette.mockImplementation((uri) => uri.includes('/old.')
    ? new Promise((resolve) => { resolveOld = resolve; })
    : Promise.resolve(PALETTE));
  act(() => {
    mockThemeStore.setState({ primaryColor: 'artwork' });
    mockPlayerStore.setState({ currentTrack: { coverArt: 'old' } });
  });
  render(<ArtworkAccentController />);
  await waitFor(() => expect(mockGetPalette).toHaveBeenCalledTimes(1));
  act(() => mockPlayerStore.setState({ currentTrack: { coverArt: 'new' } }));
  await waitFor(() => expect(mockThemeStore.getState().artworkAccent?.coverKey).toBe('new|'));
  await act(async () => resolveOld(PALETTE));
  expect(mockThemeStore.getState().artworkAccent?.coverKey).toBe('new|');
});
