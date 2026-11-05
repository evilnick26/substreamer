import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { AlbumID3 } from 'subsonic-api';

jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const Toolbar = ({ children }: any) => <View>{children}</View>;
  Toolbar.Button = () => null;
  return { Stack: { Toolbar }, useLocalSearchParams: () => ({ id: 'ballboy' }),
    useNavigation: () => ({ setOptions: jest.fn() }) };
});
jest.mock('@shopify/flash-list', () => {
  const { View } = require('react-native');
  return { FlashList: ({ data, renderItem, ListHeaderComponent, keyExtractor, getItemType }: any) => (
    <View testID="release-list">
      {ListHeaderComponent}
      {data.map((item: any, index: number) => (
        <View key={keyExtractor(item, index)} testID={getItemType?.(item) === 'header' ? 'release-header' : undefined}>
          {renderItem({ item, index })}
        </View>
      ))}
    </View>
  ) };
});
const mockRowAlbums: AlbumID3[] = [];
jest.mock('../../components/AlbumRow', () => {
  const { Text } = require('react-native');
  return { AlbumRow: ({ album }: { album: AlbumID3 }) => {
    mockRowAlbums.push(album);
    return <Text testID="album-row">{album.name}</Text>;
  } };
});
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  background: '#000', card: '#111', textPrimary: '#fff', textSecondary: '#888',
  border: '#333', primary: '#1D9BF0', label: '#888', red: '#f00',
} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../hooks/useTransitionComplete', () => ({ useTransitionComplete: () => true }));
jest.mock('../../hooks/useLayoutMode', () => ({ useLayoutMode: () => 'compact' }));
jest.mock('../../hooks/useRefreshControlKey', () => ({ useRefreshControlKey: () => 0 }));
jest.mock('../../hooks/useIsStarred', () => ({ useIsStarred: () => false }));
jest.mock('../../components/CachedImage', () => ({ CachedImage: () => null }));
jest.mock('../../components/ArtistCard', () => ({ ArtistCard: () => null }));
jest.mock('../../components/SongCard', () => ({ SongCard: () => null }));
jest.mock('../../components/SongRow', () => {
  const { Text } = require('react-native');
  return {
    SongRow: ({ song }: { song: { id: string; title: string } }) => (
      <Text testID="song-row">{song.title}</Text>
    ),
  };
});
jest.mock('../../components/BottomChrome', () => ({ BottomChrome: () => null }));
jest.mock('../../components/MoreOptionsButton', () => ({ MoreOptionsButton: () => null }));
jest.mock('../../components/DetailScreenBackground', () => ({ DetailScreenBackground: () => null }));
jest.mock('../../components/DetailHeroButtons', () => {
  const { Pressable, Text } = require('react-native');
  const Button = ({ onPress, disabled, label }: any) => (
    <Pressable onPress={onPress} disabled={disabled}>
      <Text>{label}</Text>
    </Pressable>
  );
  return {
    PlayAllButton: (props: any) => <Button {...props} label="Test Play All" />,
    ShufflePlayButton: (props: any) => <Button {...props} label="Test Shuffle All" />,
  };
});
jest.mock('../../components/PillToggle', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    PillToggle: ({ options, onSelect }: any) => (
      <View>
        {options.map((option: any) => (
          <Pressable key={option.key} onPress={() => onSelect(option.key)}>
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock('../../components/SwipeableRow', () => ({ closeOpenRow: jest.fn() }));
jest.mock('../../services/moreOptionsService', () => ({ playAllByArtist: jest.fn(), playMoreByArtist: jest.fn(), toggleStar: jest.fn() }));
jest.mock('../../services/playerService', () => ({ playTrack: jest.fn() }));
jest.mock('../../services/imageCacheService', () => ({ refreshCoverArt: jest.fn() }));
jest.mock('../../store/persistence/db', () => ({ getDb: () => ({}) }));
jest.mock('../../store/offlineModeStore', () => ({ offlineModeStore: (selector: any) => selector({ offlineMode: true }) }));
jest.mock('../../store/playbackSettingsStore', () => ({ playbackSettingsStore: Object.assign(
  (selector: any) => selector({ artistPlayMode: 'allSongs' }),
  { getState: () => ({ setArtistPlayMode: jest.fn() }) },
) }));
jest.mock('../../services/detailFetchService', () => ({
  fetchArtistBase: jest.fn(), fetchArtistBio: jest.fn(async () => null),
  fetchArtistInfo: jest.fn(async () => null), fetchArtistTopSongs: jest.fn(async () => null),
  fetchAlbumDetail: jest.fn(),
}));
const makeAlbum = (id: string, year: number, releaseTypes?: string[]): AlbumID3 => ({
  id, name: id, year, releaseTypes, songCount: 1, duration: 20, coverArt: `art-${id}`, version: 'Deluxe',
});
let mockAlbums: AlbumID3[];
let mockAppearances: Array<{ id: string; title: string; albumId: string; isDir: false }> = [];
let mockAllSongs: Array<{ id: string; title: string; albumId: string; isDir: false }> = [];
jest.mock('../../db/repository/details', () => ({
  getArtistBase: jest.fn(async () => ({
    artist: { id: 'ballboy', name: 'Ballboy', albumCount: mockAlbums.length },
    albums: mockAlbums,
  })),
  getArtistLibraryViews: jest.fn(async () => ({
    releases: mockAlbums,
    appearances: mockAppearances,
    all: mockAllSongs,
  })),
}));

import { ArtistDetailScreen } from '../artist-detail';
import { ArtistAlbumSortOrderCard } from '../../components/settings/ArtistAlbumSortOrderCard';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { fetchAlbumDetail, fetchArtistBase } from '../../services/detailFetchService';
import { playTrack } from '../../services/playerService';

beforeEach(() => {
  jest.mocked(playTrack).mockClear();
  jest.mocked(fetchAlbumDetail).mockReset();
  mockRowAlbums.length = 0;
  mockAppearances = [];
  mockAllSongs = [];
  mockAlbums = [makeAlbum('single', 2024, ['Single']), makeAlbum('album-new', 2023, ['Album']),
    makeAlbum('unknown', 2022), makeAlbum('ep', 2021, ['EP', 'Live']), makeAlbum('album-old', 2020, ['Album'])];
  layoutPreferencesStore.setState({ groupArtistReleasesByType: true, artistAlbumSortOrder: 'newest' });
  jest.mocked(fetchArtistBase).mockClear();
});

it('plays complete releases in displayed group order, including guest-credited tracks', async () => {
  mockAlbums = [
    makeAlbum('single-release', 2025, ['Single']),
    makeAlbum('album-release', 2020, ['Album']),
  ];

  const albumTrack = {
    id: 'album-track', title: 'Ballboy Track',
    albumId: 'album-release', artist: 'Ballboy', isDir: false,
  };
  const guestTrack = {
    id: 'guest-track', title: 'Guest-Credited Track',
    albumId: 'album-release', artist: 'Another Artist', isDir: false,
  };
  const singleTrack = {
    id: 'single-track', title: 'Single Track',
    albumId: 'single-release', artist: 'Ballboy', isDir: false,
  };

  jest.mocked(fetchAlbumDetail).mockImplementation(async (albumId) => ({
    id: albumId,
    song: albumId === 'album-release'
      ? [albumTrack, guestTrack]
      : [singleTrack],
  } as any));

  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(2));

  fireEvent.press(ui.getByText('Test Play All'));

  await waitFor(() => expect(playTrack).toHaveBeenCalledTimes(1));

  expect(jest.mocked(fetchAlbumDetail).mock.calls.map(([id]) => id))
    .toEqual(['album-release', 'single-release']);

  expect(jest.mocked(playTrack).mock.calls[0][1].map((song: any) => song.id))
    .toEqual(['album-track', 'guest-track', 'single-track']);
});

it('plays only the selected Appearances or All collection', async () => {
  mockAppearances = [
    { id: 'appearance-1', title: 'Guest Appearance', albumId: 'compilation', isDir: false },
  ];
  mockAllSongs = [
    { id: 'own-track', title: 'Own Track', albumId: 'own-release', isDir: false },
    ...mockAppearances,
  ];

  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));

  fireEvent.press(ui.getByText('Appearances'));
  await waitFor(() => expect(ui.getByText('Guest Appearance')).toBeTruthy());

  fireEvent.press(ui.getByText('Test Play All'));
  await waitFor(() => expect(playTrack).toHaveBeenCalledTimes(1));

  expect(jest.mocked(playTrack).mock.calls[0][1].map((song: any) => song.id))
    .toEqual(['appearance-1']);

  fireEvent.press(ui.getByText('All'));
  await waitFor(() => expect(ui.getByText('Own Track')).toBeTruthy());

  fireEvent.press(ui.getByText('Test Play All'));
  await waitFor(() => expect(playTrack).toHaveBeenCalledTimes(2));

  expect(jest.mocked(playTrack).mock.calls[1][1].map((song: any) => song.id))
    .toEqual(['own-track', 'appearance-1']);

  expect(fetchAlbumDetail).not.toHaveBeenCalled();
});

it('shuffles only tracks from the selected Appearances collection', async () => {
  mockAppearances = [
    { id: 'guest-a', title: 'Guest A', albumId: 'compilation', isDir: false },
    { id: 'guest-b', title: 'Guest B', albumId: 'compilation', isDir: false },
    { id: 'guest-c', title: 'Guest C', albumId: 'compilation', isDir: false },
  ];
  mockAllSongs = [
    { id: 'own-track', title: 'Own Track', albumId: 'own-release', isDir: false },
    ...mockAppearances,
  ];

  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));

  fireEvent.press(ui.getByText('Appearances'));
  await waitFor(() => expect(ui.getByText('Guest A')).toBeTruthy());

  fireEvent.press(ui.getByText('Test Shuffle All'));
  await waitFor(() => expect(playTrack).toHaveBeenCalledTimes(1));

  const queue = jest.mocked(playTrack).mock.calls[0][1];
  expect(queue).toHaveLength(3);
  expect(queue.map((song: any) => song.id).sort())
    .toEqual(['guest-a', 'guest-b', 'guest-c']);
  expect(jest.mocked(playTrack).mock.calls[0][0].id).toBe(queue[0].id);
  expect(fetchAlbumDetail).not.toHaveBeenCalled();
});

it('opens Appearances for an artist with no releases', async () => {
  mockAlbums = [];
  mockAppearances = [
    { id: 'guest-only', title: 'Guest Only Track', albumId: 'compilation', isDir: false },
  ];
  mockAllSongs = [...mockAppearances];

  const ui = render(<ArtistDetailScreen />);

  await waitFor(() => {
    expect(ui.getByText('Guest Only Track')).toBeTruthy();
  });

  expect(ui.queryAllByTestId('album-row')).toHaveLength(0);
});

it('defaults to Releases and switches the visible collection to Appearances', async () => {
  mockAppearances = [
    { id: 'guest-track', title: 'Guest Appearance', albumId: 'compilation', isDir: false },
  ];

  const ui = render(<ArtistDetailScreen />);

  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));

  fireEvent.press(ui.getByText('Appearances'));

  await waitFor(() => {
    expect(ui.queryAllByTestId('album-row')).toHaveLength(0);
    expect(ui.getByText('Guest Appearance')).toBeTruthy();
  });

  fireEvent.press(ui.getByText('Releases'));

  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));
});

it.each([0, 1, 2])('shows the artist count for %i releases without changing its value', async (count) => {
  mockAlbums = Array.from({ length: count }, (_, index) => makeAlbum(`release-${index}`, 2024, ['EP']));
  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getByText(`${count} ${count === 1 ? 'release' : 'releases'}`)).toBeTruthy());
});

it('renders canonical sections once, preserving row objects, artwork and versions', async () => {
  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));
  expect(ui.getAllByTestId('release-header').map((h) =>
    within(h).getByText(/^(Albums|EPs|Singles|Other Releases)$/).props.children))
    .toEqual(['Albums', 'EPs', 'Singles', 'Other Releases']);
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children))
    .toEqual(['album-new', 'album-old', 'ep', 'single', 'unknown']);
  for (const album of mockRowAlbums) expect(album).toBe(mockAlbums.find((a) => a.id === album.id));
  expect(fetchArtistBase).not.toHaveBeenCalled();
});

it('updates immediately from the Appearance switch and restores the original unified list', async () => {
  const ui = render(<><ArtistDetailScreen /><ArtistAlbumSortOrderCard /></>);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));
  fireEvent(ui.getByLabelText('Group artist releases by type'), 'valueChange', false);
  expect(ui.queryAllByTestId('release-header')).toHaveLength(0);
  expect(ui.getAllByText('Releases').length).toBeGreaterThan(0);
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children))
    .toEqual(['single', 'album-new', 'unknown', 'ep', 'album-old']);
  fireEvent(ui.getByLabelText('Group artist releases by type'), 'valueChange', true);
  expect(ui.getAllByTestId('release-header')).toHaveLength(4);
  expect(fetchArtistBase).not.toHaveBeenCalled();
});

it('preserves year sorting within groups in both directions', async () => {
  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(5));
  fireEvent.press(ui.getByText('Newest'));
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children))
    .toEqual(['album-old', 'album-new', 'ep', 'single', 'unknown']);
});

it('hides empty sections and keeps sorting available for an Other-only artist', async () => {
  mockAlbums = [makeAlbum('old', 2000), makeAlbum('new', 2020, ['Compilation'])];
  const ui = render(<ArtistDetailScreen />);
  await waitFor(() => expect(ui.getAllByTestId('album-row')).toHaveLength(2));
  expect(ui.getAllByTestId('release-header')).toHaveLength(1);
  expect(ui.getByText('Other Releases')).toBeTruthy();
  expect(ui.queryByText('Albums')).toBeNull();
  fireEvent.press(ui.getByText('Newest'));
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children)).toEqual(['old', 'new']);
  act(() => layoutPreferencesStore.getState().setGroupArtistReleasesByType(false));
  expect(ui.getAllByText('Releases').length).toBeGreaterThan(0);
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children)).toEqual(['old', 'new']);
});
