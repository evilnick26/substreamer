jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));
jest.mock('../../services/subsonicService');
jest.mock('../../services/imageCacheService', () => ({ prefetchCoverArt: jest.fn() }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  ...mockColors,
} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../../components/CachedImage', () => ({ CachedImage: (props: object) => {
  const { Image } = require('react-native');
  return <Image testID="cover" {...props} />;
} }));

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { HomeScreen } from '../sanctifi-home';
import { albumListsStore } from '../../store/albumListsStore';
import { offlineModeStore } from '../../store/offlineModeStore';
import { connectivityStore } from '../../store/connectivityStore';
import { getRecentlyAddedAlbums } from '../../services/subsonicService';
import { ensureNormalizedSchema } from '../../db/createNormalizedTables';
import { getDb } from '../../store/persistence/db';
import * as albumsRepository from '../../db/repository/albums';
import { listAlbumListRows } from '../../db/repository/albums';

let mockFocused = true;
let mockColors = { background: '#f5f5f5', textPrimary: '#111', textSecondary: '#555', primary: '#80f' };
const mockInsets = { top: 24, left: 0, right: 0, bottom: 0 };
const mockPush = jest.fn();
const fetchAlbums = jest.mocked(getRecentlyAddedAlbums);
const album = (id: string) => ({ id, name: `Title ${id}`, artist: `Album artist ${id}`, coverArt: id, songCount: 1, duration: 100 });

beforeEach(async () => {
  jest.clearAllMocks();
  mockFocused = true;
  mockInsets.top = 24;
  mockInsets.left = 0;
  mockInsets.right = 0;
  layoutPreferencesStore.setState({ dateFormat: 'yyyy/mm/dd' });
  offlineModeStore.setState({ offlineMode: false });
  connectivityStore.setState({ hasConnection: true });
  albumListsStore.setState({ recentlyAdded: [] });
  await ensureNormalizedSchema(getDb()!);
  fetchAlbums.mockResolvedValue([album('old')]);
});

test('requests exactly 20 on each opening and displays a newly returned album without library sync', async () => {
  const view = render(<HomeScreen />);
  await view.findByText('Title old');
  expect(fetchAlbums).toHaveBeenLastCalledWith(20);
  expect(view.getByText('Album artist old')).toBeTruthy();
  fireEvent.press(view.getByText('Title old'));
  expect(mockPush).toHaveBeenCalledWith('/album/old');
  mockFocused = false;
  view.rerender(<HomeScreen />);
  fetchAlbums.mockResolvedValue([album('new')]);
  mockFocused = true;
  view.rerender(<HomeScreen />);
  await view.findByText('Title new');
  expect(view.queryByText('Title old')).toBeNull();
  expect(fetchAlbums).toHaveBeenCalledTimes(2);
  expect((await listAlbumListRows(getDb()!, 'recentlyAdded')).map((a) => a.id)).toEqual(['new']);
});

test('shows loading with cached rows, keeps them on failure and retries', async () => {
  albumListsStore.setState({ recentlyAdded: [album('cached')] });
  let reject!: (reason: Error) => void;
  fetchAlbums.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const view = render(<HomeScreen />);
  expect(view.getByLabelText('Loading…')).toBeTruthy();
  expect(view.getByText('Title cached')).toBeTruthy();
  await act(async () => { reject(new Error('network')); });
  await view.findByText('Unable to refresh albums. Showing the last available list.');
  expect(view.queryByText('No recently uploaded albums.')).toBeNull();
  fetchAlbums.mockResolvedValue([album('recovered')]);
  fireEvent.press(view.getByText('Retry'));
  await view.findByText('Title recovered');
});

test.each(['mode', 'connection'])('offline %s retains cache and makes no request', async (kind) => {
  albumListsStore.setState({ recentlyAdded: [album('cached')] });
  if (kind === 'mode') offlineModeStore.setState({ offlineMode: true });
  else connectivityStore.setState({ hasConnection: false });
  const view = render(<HomeScreen />);
  expect(view.getByText('Offline — showing the last available albums.')).toBeTruthy();
  expect(view.getByText('Title cached')).toBeTruthy();
  expect(fetchAlbums).not.toHaveBeenCalled();
  expect(view.queryByText('No recently uploaded albums.')).toBeNull();
  await act(async () => {
    offlineModeStore.setState({ offlineMode: false });
    connectivityStore.setState({ hasConnection: true });
  });
  await view.findByText('Title old');
});

test('successful empty response clears SQL membership and displays empty state', async () => {
  await albumListsStore.getState().refreshRecentlyAdded(20);
  fetchAlbums.mockResolvedValue([]);
  const view = render(<HomeScreen />);
  await view.findByText('No recently uploaded albums.');
  expect(await listAlbumListRows(getDb()!, 'recentlyAdded')).toEqual([]);
});

test('failure without cache is an error, not an empty library', async () => {
  fetchAlbums.mockRejectedValue(new Error('unreachable'));
  const view = render(<HomeScreen />);
  await view.findByText('Unable to refresh albums. Showing the last available list.');
  expect(view.queryByText('No recently uploaded albums.')).toBeNull();
});

test('logo preserves the asset aspect ratio without an opaque background and rows are capped at 20', async () => {
  fetchAlbums.mockResolvedValue(Array.from({ length: 25 }, (_, i) => album(`${i}`)));
  const view = render(<HomeScreen />);
  await waitFor(() => expect(view.getAllByTestId('cover')).toHaveLength(20));
  const logo = view.getByLabelText('sancti.fi / Radio Infinite');
  expect(logo.props.resizeMode).toBe('contain');
  expect(StyleSheet.flatten(logo.props.style)).toEqual({ width: 0, height: 0 });
  const container = view.UNSAFE_getAllByType(View).find((node) => node.props.onLayout)!;
  for (const width of [288, 328, 736, 288]) {
    fireEvent(container, 'layout', { nativeEvent: { layout: { width } } });
    const style = StyleSheet.flatten(view.getByLabelText('sancti.fi / Radio Infinite').props.style);
    expect(style.width).toBe(width);
    expect(style.height).toBeCloseTo(width * 261 / 1263);
    expect(style.width / style.height).toBeCloseTo(1263 / 261);
  }
  expect(StyleSheet.flatten(logo.props.style).backgroundColor).toBeUndefined();
});

test('a blurred Home does not request until focused', async () => {
  mockFocused = false;
  const view = render(<HomeScreen />);
  expect(fetchAlbums).not.toHaveBeenCalled();
  mockFocused = true;
  view.rerender(<HomeScreen />);
  await view.findByText('Title old');
});


test('late response from an earlier opening cannot replace the newer list', async () => {
  let resolveOld!: (albums: ReturnType<typeof album>[]) => void;
  fetchAlbums.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<HomeScreen />);
  await waitFor(() => expect(fetchAlbums).toHaveBeenCalledTimes(1));
  mockFocused = false;
  view.rerender(<HomeScreen />);
  fetchAlbums.mockResolvedValue([album('fresh')]);
  mockFocused = true;
  view.rerender(<HomeScreen />);
  await view.findByText('Title fresh');
  await act(async () => { resolveOld([album('stale')]); });
  expect(view.getByText('Title fresh')).toBeTruthy();
  expect(view.queryByText('Title stale')).toBeNull();
  expect((await listAlbumListRows(getDb()!, 'recentlyAdded')).map((a) => a.id)).toEqual(['fresh']);
});


test('a newer empty result stays empty when an earlier album upsert finishes late', async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const original = albumsRepository.upsertAlbums;
  const upsert = jest.spyOn(albumsRepository, 'upsertAlbums').mockImplementationOnce(async (...args) => {
    await held;
    return original(...args);
  });
  try {
    const earlier = albumListsStore.getState().refreshRecentlyAdded(20);
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    fetchAlbums.mockResolvedValue([]);
    expect(await albumListsStore.getState().refreshRecentlyAdded(20)).toBe(true);
    release();
    expect(await earlier).toBe(false);
    expect(albumListsStore.getState().recentlyAdded).toEqual([]);
    expect(await listAlbumListRows(getDb()!, 'recentlyAdded')).toEqual([]);
  } finally {
    release();
    upsert.mockRestore();
  }
});


test('missing album artist uses the existing unknown artist label', async () => {
  fetchAlbums.mockResolvedValue([{ ...album('unknown'), artist: undefined }]);
  const view = render(<HomeScreen />);
  await view.findByText('Unknown Artist');
});


test('groups server created dates once per local day and ignores release dates', async () => {
  fetchAlbums.mockResolvedValue([
    { ...album('newest'), created: '2026-10-31T16:00:00Z' as any, year: 1959, releaseDate: { year: 1959 } },
    { ...album('same-day'), created: new Date('2026-10-31T10:00:00Z'), year: 2025 },
    { ...album('previous'), created: new Date('2026-10-30T12:00:00Z'), year: 2026 },
    { ...album('last-year'), created: new Date('2025-10-31T12:00:00Z') },
  ]);
  const view = render(<HomeScreen />);
  await view.findByText('Title last-year');
  expect(view.getAllByRole('header').map((node) => node.props.children))
    .toEqual(['2026/10/31', '2026/10/30', '2025/10/31']);
  const day = view.UNSAFE_getAllByType(View).find((node) =>
    node.props.children?.[0]?.props?.children === '2026/10/31')!;
  expect(within(day).getByText('Title newest')).toBeTruthy();
  expect(within(day).getByText('Title same-day')).toBeTruthy();
  expect(within(day).queryByText('Title previous')).toBeNull();
  expect(view.getAllByRole('button').map((node) => within(node).getAllByText(/^Title /)[0].props.children))
    .toEqual(['Title newest', 'Title same-day', 'Title previous', 'Title last-year']);
  fireEvent.press(view.getByText('Title previous'));
  expect(mockPush).toHaveBeenCalledWith('/album/previous');
  await act(async () => { layoutPreferencesStore.getState().setDateFormat('yyyy/dd/mm'); });
  expect(view.getAllByRole('header').map((node) => node.props.children))
    .toEqual(['2026/31/10', '2026/30/10', '2025/31/10']);
  expect(fetchAlbums).toHaveBeenCalledTimes(1);
});

test('missing, invalid and zero-time created values use an unavailable heading, including cached offline rows', async () => {
  offlineModeStore.setState({ offlineMode: true });
  albumListsStore.setState({ recentlyAdded: [
    album('missing'),
    { ...album('invalid'), created: new Date('bad') },
    { ...album('zero'), created: '0001-01-01T00:00:00Z' as any },
    { ...album('cached'), created: new Date(2026, 9, 30, 12) },
  ] });
  const view = render(<HomeScreen />);
  expect(view.getAllByText('Added date unavailable')).toHaveLength(1);
  expect(view.getByText('2026/10/30')).toBeTruthy();
  expect(view.getAllByTestId('cover')).toHaveLength(4);
  expect(fetchAlbums).not.toHaveBeenCalled();
});

test.each(['light', 'dark'])('logo uses the safe viewport and leaves the %s theme visible', async (theme) => {
  mockColors = theme === 'light'
    ? { background: '#f5f5f5', textPrimary: '#111', textSecondary: '#555', primary: '#80f' }
    : { background: '#121212', textPrimary: '#fff', textSecondary: '#aaa', primary: '#80f' };
  mockInsets.top = 32;
  mockInsets.left = 20;
  mockInsets.right = 16;
  const view = render(<HomeScreen />);
  await view.findByText('Title old');
  expect(view.UNSAFE_getByType(ScrollView).props.contentContainerStyle)
    .toEqual(expect.objectContaining({ paddingTop: 44, paddingLeft: 20, paddingRight: 16 }));
  expect(StyleSheet.flatten(view.getByText('Recently Uploaded').props.style).color).toBe(mockColors.textPrimary);
  const logoStyle = StyleSheet.flatten(view.getByLabelText('sancti.fi / Radio Infinite').props.style);
  expect(logoStyle.backgroundColor).toBeUndefined();
  expect(logoStyle.tintColor).toBeUndefined();
});
