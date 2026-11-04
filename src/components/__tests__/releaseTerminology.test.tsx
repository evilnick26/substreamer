import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-router/react-navigation', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  background: '#000', card: '#111', textPrimary: '#fff', textSecondary: '#888',
  border: '#333', primary: '#00f', red: '#f00',
} }) }));
jest.mock('../../hooks/useIsStarred', () => ({ useIsStarred: () => false }));
jest.mock('../../hooks/useRating', () => ({ useRating: () => 0 }));
jest.mock('../../hooks/useDownloadStatus', () => ({ useDownloadStatus: () => 'none' }));
jest.mock('../../services/playerService', () => ({ playTrack: jest.fn() }));
jest.mock('../../services/moreOptionsService', () => ({ toggleStar: jest.fn(), addSongToQueue: jest.fn() }));
jest.mock('../CachedImage', () => ({ CachedImage: () => null }));
jest.mock('../NowPlayingIndicator', () => ({ NowPlayingIndicator: () => null }));
jest.mock('../RecentSearches', () => ({ RecentSearches: () => null }));
jest.mock('../RowMetaLine', () => ({ RowMetaLine: ({ leading }: { leading: React.ReactNode }) => leading }));
jest.mock('../SwipeableRow', () => {
  const { Pressable } = require('react-native');
  return { SwipeableRow: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  ) };
});
jest.mock('../AlbumRow', () => {
  const { Text } = require('react-native');
  return { AlbumRow: ({ album }: { album: { name: string } }) => <Text>{album.name}</Text> };
});

import { ArtistRow } from '../ArtistRow';
import { SongRow } from '../SongRow';
import { SearchResultsOverlay } from '../SearchResultsOverlay';
import { SearchScreen } from '../../screens/search';
import { searchStore } from '../../store/searchStore';
import { filterBarStore } from '../../store/filterBarStore';
import { offlineModeStore } from '../../store/offlineModeStore';

beforeEach(() => {
  mockPush.mockClear();
  offlineModeStore.setState({ offlineMode: false });
  filterBarStore.setState({ downloadedOnly: false, favoritesOnly: false });
  searchStore.setState({ query: 'Artist', loading: false, isOverlayVisible: true,
    results: { artists: [], albums: [], songs: [] } });
});

it.each([0, 1, 2])('uses the shared artist row for %i releases and keeps its artist route', (count) => {
  const ui = render(<ArtistRow artist={{ id: 'artist', name: 'Artist', albumCount: count }} />);
  expect(ui.getByText(`${count} ${count === 1 ? 'release' : 'releases'}`)).toBeTruthy();
  fireEvent.press(ui.getByText('Artist'));
  expect(mockPush).toHaveBeenCalledWith('/artist/artist');
});

it.each([0, 1, 2])('shows %i releases and a Releases heading in compact Search', (count) => {
  const results = { artists: [{ id: 'artist', name: 'Artist', albumCount: count }],
    albums: [{ id: 'ep', name: 'An EP', releaseTypes: ['EP'], duration: 60, songCount: 1 }], songs: [] };
  searchStore.setState({ results });
  const ui = render(<SearchResultsOverlay />);
  expect(ui.getByText(`${count} ${count === 1 ? 'release' : 'releases'}`)).toBeTruthy();
  expect(ui.getByText('Releases')).toBeTruthy();
  fireEvent.press(ui.getByText('An EP'));
  expect(mockPush).toHaveBeenCalledWith('/album/ep');
  expect(searchStore.getState().results).toBe(results);
});

it('shows the full Search generic Releases heading and shared artist count', async () => {
  searchStore.setState({ results: { artists: [{ id: 'artist', name: 'Artist', albumCount: 2 }],
    albums: [{ id: 'single', name: 'A Single', releaseTypes: ['Single'], duration: 60, songCount: 1 }], songs: [] } });
  const ui = render(<SearchScreen />);
  await waitFor(() => expect(ui.getByText('Releases')).toBeTruthy());
  expect(ui.getByText('2 releases')).toBeTruthy();
  expect(ui.getByText('A Single')).toBeTruthy();
});

it('keeps Unknown Album in the song metadata row', () => {
  const ui = render(<SongRow song={{ id: 'song', title: 'Song', isDir: false }} />);
  expect(ui.getByText('Unknown Album')).toBeTruthy();
  expect(ui.queryByText('Unknown Release')).toBeNull();
});
