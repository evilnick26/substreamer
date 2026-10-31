jest.mock('@/store/persistence/kvStorage', () => require('@/store/persistence/__mocks__/kvStorage'));
jest.mock('expo-router', () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock('@/services/phoneOrientation', () => ({ requestPhoneOrientation: jest.fn(() => Promise.resolve()) }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useIsFocused } from 'expo-router';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { requestPhoneOrientation } from '@/services/phoneOrientation';
import { npsExperimentStore } from '@/store/npsExperimentStore';
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
  npsExperimentStore.setState({ mode: 'manual' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

it('manual starts portrait, explicitly enters landscape and returns portrait', () => {
  const { result, unmount } = renderHook(usePhoneNpsOrientation);
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => result.current.toggleManualLandscape());
  expect(request).toHaveBeenLastCalledWith('landscape');
  act(() => result.current.toggleManualLandscape());
  expect(request).toHaveBeenLastCalledWith('portrait');
  unmount();
  expect(request).toHaveBeenLastCalledWith('portrait');
  expect(remove).toHaveBeenCalled();
});

it('automatic follows focus and app lifecycle without foregrounding a departed NPS', () => {
  npsExperimentStore.setState({ mode: 'automatic' });
  const { rerender, unmount } = renderHook(usePhoneNpsOrientation);
  expect(request).toHaveBeenLastCalledWith('automatic');
  act(() => onAppState('background'));
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => onAppState('active'));
  expect(request).toHaveBeenLastCalledWith('automatic');
  jest.mocked(useIsFocused).mockReturnValue(false);
  rerender({});
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => onAppState('background'));
  act(() => onAppState('active'));
  expect(request).toHaveBeenLastCalledWith('portrait');
  unmount();
});

it('manual request survives background but resets after blur/refocus', () => {
  const { result, rerender } = renderHook(usePhoneNpsOrientation);
  act(() => result.current.toggleManualLandscape());
  act(() => onAppState('background'));
  expect(request).toHaveBeenLastCalledWith('portrait');
  act(() => onAppState('active'));
  expect(request).toHaveBeenLastCalledWith('landscape');
  jest.mocked(useIsFocused).mockReturnValue(false);
  rerender({});
  jest.mocked(useIsFocused).mockReturnValue(true);
  rerender({});
  expect(result.current.manualLandscape).toBe(false);
  expect(request).toHaveBeenLastCalledWith('portrait');
});

it('mode selection updates policy and clears manual request', () => {
  const { result } = renderHook(usePhoneNpsOrientation);
  act(() => result.current.toggleManualLandscape());
  act(() => npsExperimentStore.getState().setMode('automatic'));
  expect(request).toHaveBeenLastCalledWith('automatic');
  act(() => npsExperimentStore.getState().setMode('manual'));
  expect(result.current.manualLandscape).toBe(false);
  expect(request).toHaveBeenLastCalledWith('portrait');
});

it('reports native failures and still attempts restoration', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  request.mockRejectedValueOnce(new Error('Unavailable'));
  const { result, unmount } = renderHook(usePhoneNpsOrientation);
  await waitFor(() => expect(result.current.error).toBe(true));
  unmount();
  expect(request).toHaveBeenLastCalledWith('portrait');
});

it('leaves iOS orientation unchanged', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  renderHook(usePhoneNpsOrientation);
  expect(request).not.toHaveBeenCalled();
});

it('allows retry and an explicit portrait request after a failed manual lock', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { result } = renderHook(usePhoneNpsOrientation);
  request.mockImplementation((policy) => policy === 'landscape'
    ? Promise.reject(new Error('Activity unavailable')) : Promise.resolve());
  act(() => result.current.toggleManualLandscape());
  await waitFor(() => expect(result.current.error).toBe(true));
  request.mockResolvedValue();
  act(() => result.current.retryOrientation());
  expect(request).toHaveBeenLastCalledWith('landscape');
  act(() => result.current.returnToPortrait());
  expect(result.current.manualLandscape).toBe(false);
  expect(request).toHaveBeenLastCalledWith('portrait');
});

it('a blurred screen stops writing policies while another player may be active', () => {
  const { rerender, unmount } = renderHook(usePhoneNpsOrientation);
  jest.mocked(useIsFocused).mockReturnValue(false);
  rerender({});
  expect(request).toHaveBeenLastCalledWith('portrait');
  request.mockClear();
  act(() => onAppState('background'));
  act(() => onAppState('active'));
  act(() => npsExperimentStore.getState().setMode('automatic'));
  unmount();
  expect(request).not.toHaveBeenCalled();
});
