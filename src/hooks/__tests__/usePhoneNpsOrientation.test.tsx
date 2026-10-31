jest.mock('expo-router', () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock('@/services/phoneOrientation', () => ({ requestPhoneOrientation: jest.fn(() => Promise.resolve()) }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { requestPhoneOrientation } from '@/services/phoneOrientation';
import { usePhoneNpsOrientation } from '../usePhoneNpsOrientation';

const request = jest.mocked(requestPhoneOrientation);
let onAppState: (state: AppStateStatus) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.mocked(useIsFocused).mockReturnValue(true);
  request.mockResolvedValue();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

it('uses USER only while focused and active, restoring portrait on blur/unmount', () => {
  const { rerender, unmount } = renderHook(usePhoneNpsOrientation);
  expect(request).toHaveBeenLastCalledWith('user');
  act(() => onAppState('background'));
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => onAppState('active'));
  expect(request).toHaveBeenLastCalledWith('user');
  jest.mocked(useIsFocused).mockReturnValue(false);
  rerender({});
  expect(request).toHaveBeenLastCalledWith('portrait');
  request.mockClear();
  act(() => onAppState('background'));
  act(() => onAppState('active'));
  expect(request).not.toHaveBeenCalled();
  jest.mocked(useIsFocused).mockReturnValue(true);
  rerender({});
  expect(request).toHaveBeenLastCalledWith('user');
  unmount();
  expect(request).toHaveBeenLastCalledWith('portrait');
  expect(remove).toHaveBeenCalled();
});

it('does not request USER while initially backgrounded or blurred', () => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
  const screen = renderHook(usePhoneNpsOrientation);
  expect(request).toHaveBeenLastCalledWith('portrait');
  screen.unmount();
  request.mockClear();
  jest.mocked(useIsFocused).mockReturnValue(false);
  renderHook(usePhoneNpsOrientation);
  expect(request).not.toHaveBeenCalled();
});

it('logs a native failure, still restores portrait and retries on foreground', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  request.mockRejectedValueOnce(new Error('Unavailable'));
  const { unmount } = renderHook(usePhoneNpsOrientation);
  await waitFor(() => expect(warn).toHaveBeenCalledWith('[NPS orientation] Native policy request failed', expect.any(Error)));
  act(() => onAppState('background'));
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => onAppState('active'));
  expect(request).toHaveBeenLastCalledWith('user');
  unmount();
  expect(request).toHaveBeenLastCalledWith('portrait');
});

it('leaves iOS orientation unchanged', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  renderHook(usePhoneNpsOrientation);
  expect(request).not.toHaveBeenCalled();
});
