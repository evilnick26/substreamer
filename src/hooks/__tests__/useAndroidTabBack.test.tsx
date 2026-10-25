import { act, renderHook } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import * as MoveToBack from 'expo-move-to-back';

import { useAndroidTabBack } from '../useAndroidTabBack';

const mockNavigate = jest.fn();
const mockRouter = { navigate: mockNavigate };
let mockSegments: string[];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useSegments: () => mockSegments }));

let handler: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
let remove: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(MoveToBack, 'moveToBack').mockImplementation(() => {});
  jest.replaceProperty(Platform, 'OS', 'android');
  mockSegments = ['(tabs)', 'library'];
  remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, callback) => {
    handler = callback;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

function pressBack() {
  let handled;
  act(() => { handled = handler?.({ type: 'hardwareBackPress', timeStamp: Date.now() }); });
  return handled;
}

test('Back on Library is consumed and backgrounds the app', () => {
  renderHook(useAndroidTabBack);
  expect(BackHandler.addEventListener).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
  expect(pressBack()).toBe(true);
  expect(MoveToBack.moveToBack).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each(['favorites', 'search', 'settings', 'index', null])('Back on root tab %s is consumed and navigates to Library', (tab) => {
  mockSegments = tab ? ['(tabs)', tab] : ['(tabs)'];
  renderHook(useAndroidTabBack);
  expect(pressBack()).toBe(true);
  expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/library');
  expect(MoveToBack.moveToBack).not.toHaveBeenCalled();
});

test.each([['album', '123'], ['artist', '123'], ['playlist', '123'], ['player'], ['login'], ['play'], []].map((segments) => [segments]))('non-tab route %s passes Back to its existing handler', (segments) => {
  mockSegments = segments;
  renderHook(useAndroidTabBack);
  expect(pressBack()).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(MoveToBack.moveToBack).not.toHaveBeenCalled();
});

test('navigation changes remove the old listener and register the current tab handler', () => {
  mockSegments = ['(tabs)', 'search'];
  const { rerender, unmount } = renderHook(useAndroidTabBack);
  expect(pressBack()).toBe(true);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  mockSegments = ['(tabs)', 'library'];
  rerender({});
  expect(remove).toHaveBeenCalledTimes(1);
  expect(pressBack()).toBe(true);
  expect(MoveToBack.moveToBack).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});

test('iOS does not register an Android Back override', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  renderHook(useAndroidTabBack);
  expect(BackHandler.addEventListener).not.toHaveBeenCalled();
});
