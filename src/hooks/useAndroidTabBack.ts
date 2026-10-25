import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { moveToBack } from 'expo-move-to-back';

/** Keep Android root-tab Back handling out of the native tab fragments. */
export function useAndroidTabBack() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = () => {
      // Intercept root tabs so react-native-screens does not call canNavigateBack()
      // on a tab fragment instead of a ScreenStack (IllegalStateException).
      if (segments[0] === '(tabs)') {
        const tab = (segments as string[])[1];
        if (tab === 'library') {
          moveToBack();
        } else {
          router.navigate('/(tabs)/library');
        }
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [segments, router]);
}
