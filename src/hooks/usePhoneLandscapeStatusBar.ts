import { useIsFocused } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Platform, StatusBar } from 'react-native';

import { appStateStore } from '@/store/appStateStore';

/** Own only a focused landscape override; popping restores the existing app entry. */
export function usePhoneLandscapeStatusBar(landscape: boolean) {
  const focused = useIsFocused();
  const active = appStateStore((s) => s.isActive);
  useLayoutEffect(() => {
    if (Platform.OS !== 'android' || !landscape || !focused || !active) return;
    const entry = StatusBar.pushStackEntry({ hidden: true, animated: false });
    return () => StatusBar.popStackEntry(entry);
  }, [landscape, focused, active]);
}
