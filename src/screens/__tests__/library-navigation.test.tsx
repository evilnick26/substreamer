import React from 'react';
import { Platform, Text } from 'react-native';
import { renderRouter, screen, fireEvent, act, waitFor } from 'expo-router/testing-library';
import { router, Stack, Tabs } from 'expo-router';
import { store, storeRef } from 'expo-router/build/global-state/store';

import TabLayout from '../../app/(tabs)/_layout';
import HomeTab from '../../app/(tabs)/index';
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
jest.mock('../../screens/home', () => {
  const { Text } = require('react-native');
  return { HomeScreen: () => <Text>Retained Home screen</Text> };
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
  '(tabs)/favorites': () => <Text>Favourites screen</Text>,
  '(tabs)/search': () => <Text>Search screen</Text>,
  '(tabs)/settings': () => <Text>Settings screen</Text>,
};
beforeEach(() => {
  mockLoggedIn = true;
  // A new Router tree models a cold start, without the last test's group preference.
  delete storeRef.current.routeInfo;
});
afterEach(() => jest.useRealTimers());

test('authenticated cold startup lands on Library and only the four retained tabs are visible', async () => {
  renderRouter(routes, { initialUrl: '/' });
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
  expect(screen.getByRole(tabRole, { name: /Library/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Favourites|Favorites/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Search/ })).toBeTruthy();
  expect(screen.getByRole(tabRole, { name: /Settings/ })).toBeTruthy();
  expect(screen.queryByRole(tabRole, { name: /Home/ })).toBeNull();
  expect(screen.getAllByRole(tabRole)).toHaveLength(4);
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

test('the hidden Home route remains reachable without being advertised as a tab', async () => {
  renderRouter(routes, { initialUrl: '/(tabs)' });
  await screen.findByText('Retained Home screen');
  expect(screen.queryByRole(tabRole, { name: /Home/ })).toBeNull();
  fireEvent.press(screen.getByRole(tabRole, { name: /Library/ }));
  await waitFor(() => expect(store.getRouteInfo().pathname).toBe('/library'));
});

test.each([['Search', '/search', 'Search screen'], ['Settings', '/settings', 'Settings screen'],
  ['Favorites', '/favorites', 'Favourites screen']] as const)('%s remains navigable', async (name, pathname, content) => {
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

test('navigator Back from another tab returns to Library rather than hidden Home', async () => {
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
