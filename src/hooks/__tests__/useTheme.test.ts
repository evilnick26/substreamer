jest.mock('../../store/persistence', () => require('../../store/persistence/__mocks__/kvStorage'));
jest.mock('../../store/playerStore', () => ({
  playerStore: (selector: (state: object) => unknown) => selector({
    currentTrack: { coverArt: 'grey', albumId: 'album' },
  }),
}));

let mockSystemScheme: 'dark' | 'light' | null = 'dark';
jest.mock('react-native', () => ({ useColorScheme: () => mockSystemScheme }));

import { act, renderHook } from '@testing-library/react-native';
import { themeStore } from '../../store/themeStore';
import { useTheme } from '../useTheme';

beforeEach(() => {
  mockSystemScheme = 'dark';
  themeStore.setState({
    themePreference: 'dark',
    primaryColor: 'artwork',
    artworkAccent: { coverKey: 'grey|album', palette: { dark: '#909090', light: '#505050' } },
  });
});

it('updates the cached monochrome accent when the selected theme changes', () => {
  const { result } = renderHook(() => useTheme());
  const cachedAccent = themeStore.getState().artworkAccent;
  expect(result.current.colors.primary).toBe('#909090');
  act(() => themeStore.getState().setThemePreference('light'));
  expect(result.current.colors.primary).toBe('#505050');
  act(() => themeStore.getState().setThemePreference('dark'));
  expect(result.current.colors.primary).toBe('#909090');
  expect(themeStore.getState().artworkAccent).toBe(cachedAccent);
});

it('follows system theme changes with the same cached artwork', () => {
  themeStore.setState({ themePreference: 'system' });
  const { result, rerender } = renderHook(() => useTheme());
  expect(result.current.colors.primary).toBe('#909090');
  mockSystemScheme = 'light';
  rerender({});
  expect(result.current.colors.primary).toBe('#505050');
});

it('preserves explicit static colours across theme changes', () => {
  themeStore.setState({ primaryColor: '#E91429' });
  const { result } = renderHook(() => useTheme());
  expect(result.current.colors.primary).toBe('#E91429');
  act(() => themeStore.getState().setThemePreference('light'));
  expect(result.current.colors.primary).toBe('#E91429');
});

it('retains blue for a missing or unreadable artwork result', () => {
  themeStore.setState({ artworkAccent: null });
  const { result } = renderHook(() => useTheme());
  expect(result.current.colors.primary).toBe('#1D9BF0');
});

it('preserves an explicit Blue preference when the system colour scheme is unavailable', () => {
  mockSystemScheme = null;
  themeStore.setState({ primaryColor: null, themePreference: 'system' });
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('dark');
  expect(result.current.colors.primary).toBe('#1D9BF0');
});
