import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useClientUpdateFeedback } from '../hooks/useClientUpdateFeedback';
import { clientUpdateChecker, type UpdateResult } from '../services/clientUpdateService';
import { themedAlertStore } from '../store/themedAlertStore';
import { onboardingStore } from '../store/onboardingStore';
import { certPromptStore } from '../store/certPromptStore';
import { backgroundPlaybackPromptStore } from '../store/backgroundPlaybackPromptStore';

/** Foreground startup checks never block hydration, navigation or playback. */
export function ClientUpdateController({ ready }: { ready: boolean }) {
  const showUpdate = useClientUpdateFeedback();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [result, setResult] = useState<UpdateResult | null>(null);
  const alertVisible = themedAlertStore((s) => s.visible);
  const onboardingVisible = onboardingStore((s) => s.visible);
  const certificateVisible = certPromptStore((s) => s.visible);
  const playbackPromptVisible = backgroundPlaybackPromptStore((s) => s.visible);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    setActive(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      if (AppState.currentState !== 'active') return;
      const next = await clientUpdateChecker.checkAutomatic();
      if (cancelled) return;
      setResult(next);
      const delay = clientUpdateChecker.getAutomaticRetryDelay();
      if (delay !== null) timer = setTimeout(() => { void check(); }, delay);
    }
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, active]);

  useEffect(() => {
    if (!ready || !active || AppState.currentState !== 'active' || alertVisible || onboardingVisible ||
        certificateVisible || playbackPromptVisible || result?.status !== 'available' ||
        themedAlertStore.getState().visible) return;
    if (clientUpdateChecker.claimPrompt(result.manifest.versionCode)) showUpdate(result.manifest);
  }, [ready, active, result, alertVisible, onboardingVisible, certificateVisible, playbackPromptVisible, showUpdate]);

  return null;
}
