import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { clientUpdateChecker } from '../../services/clientUpdateService';
import { useClientUpdateFeedback } from '../../hooks/useClientUpdateFeedback';

/** The sancti.fi identity and manual update target, separate from the upstream footer. */
export function SanctifiVersionLabel() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const showUpdate = useClientUpdateFeedback();
  const configuredVersion = Constants.expoConfig?.extra?.sanctifiVersion;
  const version = typeof configuredVersion === 'string' && configuredVersion.length > 0
    ? configuredVersion : t('unknown');
  const build = Application.nativeBuildVersion || t('unknown');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function checkForUpdates() {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setMessage(t('clientUpdateChecking'));
    const result = await clientUpdateChecker.check();
    busy.current = false;
    if (!mounted.current) return;
    setChecking(false);
    if (result.status === 'error') {
      setMessage(t(`clientUpdateError_${result.reason}`));
    } else if (result.status === 'available') {
      setMessage(t('clientUpdateRelease', { version: result.manifest.versionName, build: result.manifest.versionCode }));
      showUpdate(result.manifest);
    } else {
      setMessage(t(result.status === 'current' ? 'clientUpdateCurrent' : 'clientUpdateAhead', { build: result.installedVersionCode }));
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('clientUpdateCheck')}
      accessibilityHint={t('clientUpdateCheckHint')}
      accessibilityValue={{ text: `${t('clientVersionLabel', { version })}, ${t('clientBuildLabel', { build })}` }}
      accessibilityState={{ busy: checking, disabled: checking }}
      disabled={checking}
      onPress={checkForUpdates}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>sancti.fi Client</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>{t('clientVersionLabel', { version })}</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>{t('clientBuildLabel', { build })}</Text>
      <Text style={[styles.hint, { color: colors.primary }]}>{t('clientUpdateTapHint')}</Text>
      {message !== null && (
        <Text accessibilityLiveRegion="polite" style={[styles.version, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  pressed: { opacity: 0.7 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  version: { fontSize: 14, textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
});
