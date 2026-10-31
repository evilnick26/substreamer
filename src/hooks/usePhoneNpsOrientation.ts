import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { requestPhoneOrientation } from '@/services/phoneOrientation';

export function usePhoneNpsOrientation() {
  const focused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !focused) return;
    requestPhoneOrientation(appState === 'active' ? 'user' : 'portrait').catch((cause: unknown) => {
      console.warn('[NPS orientation] Native policy request failed', cause);
    });
    return () => {
      requestPhoneOrientation('portrait').catch((cause: unknown) => {
        console.warn('[NPS orientation] Portrait restoration failed', cause);
      });
    };
  }, [focused, appState]);
}
