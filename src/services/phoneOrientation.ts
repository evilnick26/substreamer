import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export type PhoneOrientationPolicy = 'portrait' | 'automatic' | 'landscape';

let pending = Promise.resolve();
let generation = 0;

/** Serialize startup, focus and cleanup requests; discard superseded queued work. */
export function requestPhoneOrientation(policy: PhoneOrientationPolicy): Promise<void> {
  const request = ++generation;
  const result = pending.then(async () => {
    if (request !== generation) return;
    if (policy === 'automatic' && Platform.OS === 'android') {
      // ActivityInfo.SCREEN_ORIENTATION_USER respects Android's rotation preference.
      await ScreenOrientation.lockPlatformAsync({ screenOrientationConstantAndroid: 2 });
    } else {
      await ScreenOrientation.lockAsync(
        policy === 'landscape'
          ? ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
          : ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    }
  });
  // A rejected native request must not prevent the next restoration attempt.
  pending = result.catch(() => {});
  return result;
}
