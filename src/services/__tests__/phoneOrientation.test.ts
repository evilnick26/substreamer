jest.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 3 },
  lockAsync: jest.fn(() => Promise.resolve()),
  lockPlatformAsync: jest.fn(() => Promise.resolve()),
}));

import * as Orientation from 'expo-screen-orientation';
import { Platform } from 'react-native';
import { requestPhoneOrientation } from '../phoneOrientation';

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
});

it('uses Android USER and explicitly restores the global phone portrait policy', async () => {
  await requestPhoneOrientation('user');
  expect(Orientation.lockPlatformAsync).toHaveBeenCalledWith({ screenOrientationConstantAndroid: 2 });
  await requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('a pending USER request cannot override cleanup and obsolete queued requests are skipped', async () => {
  let finish!: () => void;
  jest.mocked(Orientation.lockPlatformAsync).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const user = requestPhoneOrientation('user');
  await Promise.resolve();
  const obsolete = requestPhoneOrientation('user');
  const restore = requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).not.toHaveBeenCalled();
  finish();
  await Promise.all([user, obsolete, restore]);
  expect(Orientation.lockPlatformAsync).toHaveBeenCalledTimes(1);
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('a rejected native request does not block restoration', async () => {
  jest.mocked(Orientation.lockPlatformAsync).mockRejectedValueOnce(new Error('Activity unavailable'));
  await expect(requestPhoneOrientation('user')).rejects.toThrow('Activity unavailable');
  await requestPhoneOrientation('portrait');
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

it('retains the iOS phone portrait request', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await requestPhoneOrientation('portrait');
  expect(Orientation.lockPlatformAsync).not.toHaveBeenCalled();
  expect(Orientation.lockAsync).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});
