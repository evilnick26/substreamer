jest.mock('expo-router', () => ({ useIsFocused: jest.fn(() => true) }));
import { act, renderHook } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { Platform, StatusBar } from 'react-native';
import { appStateStore } from '@/store/appStateStore';
import { usePhoneLandscapeStatusBar } from '../usePhoneLandscapeStatusBar';

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.mocked(useIsFocused).mockReturnValue(true);
  appStateStore.setState({ isActive: true });
  jest.spyOn(StatusBar, 'pushStackEntry');
  jest.spyOn(StatusBar, 'popStackEntry');
});
afterEach(() => jest.restoreAllMocks());

it('pushes one nonanimated override only in landscape and pops the same entry on portrait', () => {
  const { rerender, unmount } = renderHook(({ landscape }: { landscape: boolean }) => usePhoneLandscapeStatusBar(landscape), { initialProps: { landscape: false } });
  expect(StatusBar.pushStackEntry).not.toHaveBeenCalled();
  for (let i = 0; i < 3; i++) {
    rerender({ landscape: true });
    expect(StatusBar.pushStackEntry).toHaveBeenLastCalledWith({ hidden: true, animated: false });
    const entry = jest.mocked(StatusBar.pushStackEntry).mock.results.at(-1)?.value;
    rerender({ landscape: true });
    expect(StatusBar.pushStackEntry).toHaveBeenCalledTimes(i + 1);
    rerender({ landscape: false });
    expect(StatusBar.popStackEntry).toHaveBeenLastCalledWith(entry);
  }
  unmount();
  expect(StatusBar.popStackEntry).toHaveBeenCalledTimes(3);
});

it('restores across blur, foreground while blurred, focus, background and unmount', () => {
  const { rerender, unmount } = renderHook(() => usePhoneLandscapeStatusBar(true));
  jest.mocked(useIsFocused).mockReturnValue(false);
  rerender({});
  expect(StatusBar.popStackEntry).toHaveBeenCalledTimes(1);
  act(() => appStateStore.setState({ isActive: false }));
  act(() => appStateStore.setState({ isActive: true }));
  expect(StatusBar.pushStackEntry).toHaveBeenCalledTimes(1);
  jest.mocked(useIsFocused).mockReturnValue(true);
  rerender({});
  expect(StatusBar.pushStackEntry).toHaveBeenCalledTimes(2);
  act(() => appStateStore.setState({ isActive: false }));
  expect(StatusBar.popStackEntry).toHaveBeenCalledTimes(2);
  act(() => appStateStore.setState({ isActive: true }));
  expect(StatusBar.pushStackEntry).toHaveBeenCalledTimes(3);
  unmount();
  expect(StatusBar.popStackEntry).toHaveBeenCalledTimes(3);
});

it('does not change iOS status bars', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  renderHook(() => usePhoneLandscapeStatusBar(true));
  expect(StatusBar.pushStackEntry).not.toHaveBeenCalled();
});
