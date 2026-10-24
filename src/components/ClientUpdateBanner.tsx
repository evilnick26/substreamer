import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../hooks/useTheme';
import { useClientUpdateFeedback } from '../hooks/useClientUpdateFeedback';
import { clientUpdateChecker } from '../services/clientUpdateService';
import type { ReleaseManifest } from '../utils/releaseManifest';

/** A nonmodal startup notice; checking never blocks the app or playback. */
export function ClientUpdateBanner() {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const { t } = useTranslation();
  const showUpdate = useClientUpdateFeedback();
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);

  useEffect(() => {
    let active = true;
    void clientUpdateChecker.checkAutomatic().then((result) => {
      if (active && result.status === 'available' && clientUpdateChecker.claimPrompt(result.manifest.versionCode)) {
        setManifest(result.manifest);
      }
    });
    return () => { active = false; };
  }, []);

  if (!manifest) return null;
  return (
    <View style={[styles.banner, { top: top + 8, backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.textPrimary }}>
        {t('clientUpdateAvailable')}{'\n'}
        {t('clientUpdateRelease', { version: manifest.versionName, build: manifest.versionCode })}
      </Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setManifest(null)} style={styles.action}>
          <Text style={{ color: colors.textSecondary }}>{t('clientUpdateDismiss')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { showUpdate(manifest); setManifest(null); }} style={styles.action}>
          <Text style={{ color: colors.primary }}>{t('clientUpdateDetails')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 16, right: 16, zIndex: 100, borderWidth: 1, borderRadius: 12, padding: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  action: { padding: 12 },
});
