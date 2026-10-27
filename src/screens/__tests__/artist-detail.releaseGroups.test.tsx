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
jest.mock('../../components/BottomChrome', () => ({ BottomChrome: () => null }));
jest.mock('../../components/MoreOptionsButton', () => ({ MoreOptionsButton: () => null }));
jest.mock('../../components/DetailScreenBackground', () => ({ DetailScreenBackground: () => null }));
jest.mock('../../components/DetailHeroButtons', () => ({ PlayAllButton: () => null, ShufflePlayButton: () => null }));
jest.mock('../../components/PillToggle', () => ({ PillToggle: () => null }));
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
}));
const makeAlbum = (id: string, year: number, releaseTypes?: string[]): AlbumID3 => ({
  id, name: id, year, releaseTypes, songCount: 1, duration: 20, coverArt: `art-${id}`, version: 'Deluxe',
});
let mockAlbums: AlbumID3[];
jest.mock('../../db/repository/details', () => ({ getArtistBase: jest.fn(async () => ({
  artist: { id: 'ballboy', name: 'Ballboy', albumCount: mockAlbums.length }, albums: mockAlbums,
})) }));

import { ArtistDetailScreen } from '../artist-detail';
import { ArtistAlbumSortOrderCard } from '../../components/settings/ArtistAlbumSortOrderCard';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { fetchArtistBase } from '../../services/detailFetchService';

beforeEach(() => {
  mockRowAlbums.length = 0;
  mockAlbums = [makeAlbum('single', 2024, ['Single']), makeAlbum('album-new', 2023, ['Album']),
    makeAlbum('unknown', 2022), makeAlbum('ep', 2021, ['EP', 'Live']), makeAlbum('album-old', 2020, ['Album'])];
  layoutPreferencesStore.setState({ groupArtistReleasesByType: true, artistAlbumSortOrder: 'newest' });
  jest.mocked(fetchArtistBase).mockClear();
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
  expect(ui.getByText('Albums')).toBeTruthy();
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
  expect(ui.getByText('Albums')).toBeTruthy();
  expect(ui.getAllByTestId('album-row').map((r) => r.props.children)).toEqual(['old', 'new']);
});
