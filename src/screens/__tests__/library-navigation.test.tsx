import React from 'react';
import { Platform, Text } from 'react-native';
import { renderRouter, screen, fireEvent, act, waitFor, within } from 'expo-router/testing-library';
import { router, Stack, Tabs } from 'expo-router';
import { store, storeRef } from 'expo-router/build/global-state/store';

import TabLayout from '../../app/(tabs)/_layout';
import HomeTab from '../../app/(tabs)/index';
import FavoritesTab from '../../app/(tabs)/favorites';
import { IndexScreen } from '../../screens/index';

jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  background: '#fff', primary: '#00f', textSecondary: '#555',
} }) }));
jest.mock('../../components/GradientBackground', () => ({ GradientBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../../components/BottomChrome', () => ({ BottomChrome: () => null }));
jest.mock('../../components/BannerStack', () => ({ BannerStack: () => null }));
jest.mock('../../components/SearchResultsOverlay', () => ({ SearchResultsOverlay: () => null }));
jest.mock('../../components/SearchableHeader', () => ({ SearchableHeader: () => null }));
jest.mock('../../components/WaveformLogo', () => ({ __esModule: true, default: () => null }));
jest.mock('../../screens/sanctifi-home', () => {
  const { Text } = require('react-native');
  return { HomeScreen: () => <Text>sanctifi Home screen</Text> };
});
jest.mock('../../screens/favorites', () => {
  const { Text } = require('react-native');
  return { FavoritesScreen: () => <Text>Favourites screen</Text> };
});
jest.mock('../../store/searchStore', () => ({ searchStore: { getState: () => ({ setHeaderHeight: jest.fn() }) } }));
jest.mock('../../store/authStore', () => ({ authStore: (select: (state: { isLoggedIn: boolean }) => unknown) => select({ isLoggedIn: mockLoggedIn }) }));
let mockLoggedIn = true;

const tabRole = Platform.OS === 'ios' ? 'button' : 'tab';
const routes = {
  _layout: {
    default: () => <Stack><Stack.Screen name="login" /><Stack.Screen name="(tabs)" /></Stack>,
    unstable_settings: { initialRouteName: 'index' },
  },
  index: IndexScreen,
  login: () => <Text>Login screen</Text>,
  'album/[id]': () => <Text>Album detail screen</Text>,
  player: () => <Text>Now Playing screen</Text>,
  '(tabs)/_layout': TabLayout,
  '(tabs)/index': HomeTab,
  '(tabs)/library': () => <Text>Library screen</Text>,
  '(tabs)/favorites': FavoritesTab,
  '(tabs)/search': () => <Text>Search screen</Text>,
  '(tabs)/settings': () => <Text>Settings screen</Text>,
};
beforeEach(() => {
  mockLoggedIn = true;
  // A new Router tree models a cold start, without the last test's group preference.
  delete storeRef.current.routeInfo;
});
afterEach(() => jest.useRealTimers());

test('authenticated cold startup lands on Library and all five tabs are visible', async () => {
  renderRouter(routes, { initialUrl: '/' });
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
  expect(screen.getByRole(tabRole, { name: /Library/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Shelf/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Search/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Settings/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Home/ })).toBeTruthy();
  expect(screen.getAllByRole(tabRole)).toHaveLength(5);
});

test('the tab navigator declares Library as its initial and Back destination', async () => {
  // Inspect the production navigator inside a real Router tree.
  renderRouter({
    _layout: TabLayout,
    index: HomeTab,
    library: routes['(tabs)/library'], favorites: routes['(tabs)/favorites'],
    search: routes['(tabs)/search'], settings: routes['(tabs)/settings'],
  }, { initialUrl: '/library' });
  const navigator = screen.UNSAFE_getByType(Tabs);
  expect(navigator.props.initialRouteName).toBe('library');
  expect(navigator.props.backBehavior).toBe('initialRoute');
});

test('Home is reachable from its route and tab', async () => {
  renderRouter(routes, { initialUrl: '/(tabs)' });
  await screen.findByText('sanctifi Home screen');
  expect(screen.getByRole(tabRole, { name: /Home/ })).toBeTruthy();
  fireEvent.press(screen.getByRole(tabRole, { name: /Library/ }));
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
  fireEvent.press(screen.getByRole(tabRole, { name: /Home/ }));
  await screen.findByText('sanctifi Home screen');
});

test.each([['Search', '/search', 'Search screen'], ['Settings', '/settings', 'Settings screen'],
  ['Shelf', '/favorites', 'Favourites screen']] as const)('%s remains navigable', async (name, pathname, content) => {
  renderRouter(routes, { initialUrl: '/library' });
  fireEvent.press(screen.getByRole(tabRole, { name: new RegExp(name) }));
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe(pathname));
  expect(screen.getByText(content)).toBeTruthy();
});

test('logged-out startup goes to login, then authenticated index goes to Library', async () => {
  mockLoggedIn = false;
  renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('Login screen');
  expect(store.getRouteInfo().pathname).toBe('/login');
  mockLoggedIn = true;
  act(() => router.replace('/'));
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
});

// Keep the lightweight root fixture aligned with the production root's link anchor.
test('the production root anchors ambiguous / links on its redirecting index', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const source = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');
  expect(source).toMatch(/export const unstable_settings = \{\s*initialRouteName: 'index',?\s*\};/);
  expect(source).toContain('useAndroidTabBack();');
  expect(source).toContain("router.replace('/(tabs)/library')");
});

test('navigator Back from another tab returns to Library rather than Home', async () => {
  renderRouter(routes, { initialUrl: '/library' });
  fireEvent.press(screen.getByRole(tabRole, { name: /Search/ }));
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/search'));
  act(() => router.back());
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
});

test.each([['/album/123', 'Album detail screen'], ['/player', 'Now Playing screen']] as const)('stack route %s returns to the selected tab', async (path, content) => {
  renderRouter(routes, { initialUrl: '/search' });
  act(() => router.push(path));
  await screen.findByText(content);
  act(() => router.back());
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/search'));
  expect(screen.getByText('Search screen')).toBeTruthy();
});

test('Shelf keeps the heart, original title, route, order and selection semantics', async () => {
  renderRouter(routes, { initialUrl: '/library' });
  const before = screen.getByRole(tabRole, { name: /Shelf/, selected: false });
  expect(within(before).getAllByTestId('icon-heart').length).toBeGreaterThan(0);
  const declarations = screen.UNSAFE_getByType(Tabs).props.children;
  expect(declarations.map((child: React.ReactElement<{ name: string }>) => child.props.name))
    .toEqual(['index', 'library', 'favorites', 'search', 'settings']);
  const favoriteOptions = declarations.find((child: React.ReactElement<{ name: string }>) => child.props.name === 'favorites').props.options;
  expect(favoriteOptions.title).toBe('Favorites');
  expect(favoriteOptions.tabBarAccessibilityLabel).toBeUndefined();
  fireEvent.press(before);
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/favorites'));
  expect(screen.getByRole(tabRole, { name: /Shelf/, selected: true })).toBeTruthy();
  expect(screen.queryByRole(tabRole, { name: /Favourites|Favorites/ })).toBeNull();
  expect(screen.getByText('Favourites screen')).toBeTruthy();
});
