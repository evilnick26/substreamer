jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 3, LANDSCAPE_LEFT: 7 },
  lockAsync: jest.fn(() => Promise.resolve()),
  lockPlatformAsync: jest.fn(() => Promise.resolve()),
}));

import * as Orientation from 'expo-screen-orientation';
import { requestPhoneOrientation } from '../phoneOrientation';

beforeEach(() => jest.clearAllMocks());

it('uses Android USER for automatic mode and explicit locks for manual mode', async () => {
  // This suite checks the Android platform branch on both Jest projects.
  const { Platform } = require('react-native');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  await requestPhoneOrientation('automatic');
  expect(Orientation.lockPlatformAsync).toHaveBeenCalledWith({ screenOrientationConstantAndroid: 2 });
  await requestPhoneOrientation('landscape');
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.LANDSCAPE_LEFT);
  await requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('restores portrait after an in-flight landscape request and skips obsolete queued requests', async () => {
  let finish!: () => void;
  jest.mocked(Orientation.lockAsync).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const landscape = requestPhoneOrientation('landscape');
  await Promise.resolve();
  const obsolete = requestPhoneOrientation('automatic');
  const restore = requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([landscape, obsolete, restore]);
  expect(Orientation.lockPlatformAsync).not.toHaveBeenCalled();
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('a rejected native request does not block cleanup', async () => {
  jest.mocked(Orientation.lockAsync).mockRejectedValueOnce(new Error('Activity unavailable'));
  await expect(requestPhoneOrientation('landscape')).rejects.toThrow('Activity unavailable');
  await requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('a pending automatic request cannot override a later portrait restoration', async () => {
  const { Platform } = require('react-native');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  let finish!: () => void;
  jest.mocked(Orientation.lockPlatformAsync).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const automatic = requestPhoneOrientation('automatic');
  await Promise.resolve();
  const restore = requestPhoneOrientation('portrait');
  finish();
  await Promise.all([automatic, restore]);
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});
