import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { requestPhoneOrientation } from '@/services/phoneOrientation';
import { npsExperimentStore } from '@/store/npsExperimentStore';

export function usePhoneNpsOrientation() {
  const focused = useIsFocused();
  const mode = npsExperimentStore((s) => s.mode);
  const [manualLandscape, setManualLandscape] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || mode !== 'manual') setManualLandscape(false);
  }, [focused, mode]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !focused) return;
    let current = true;
    const policy = appState !== 'active'
      ? 'portrait'
      : mode === 'automatic' ? 'automatic' : manualLandscape ? 'landscape' : 'portrait';
    setError(false);
    requestPhoneOrientation(policy).catch((cause: unknown) => {
      console.warn('[NPS orientation] Native policy request failed', cause);
      if (current) setError(true);
    });
    return () => {
      current = false;
      requestPhoneOrientation('portrait').catch((cause: unknown) => {
        console.warn('[NPS orientation] Portrait restoration failed', cause);
      });
    };
  }, [focused, appState, mode, manualLandscape, retry]);

  return {
    mode,
    manualLandscape,
    toggleManualLandscape: () => setManualLandscape((value) => !value),
    retryOrientation: () => setRetry((value) => value + 1),
    returnToPortrait: () => {
      setManualLandscape(false);
      setRetry((value) => value + 1);
    },
    error,
  };
}
