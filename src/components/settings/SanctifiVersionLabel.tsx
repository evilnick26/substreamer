import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { SANCTIFI_VERSION } from '../../config/sanctifiVersion';
import { clientUpdateChecker } from '../../services/clientUpdateService';
import { useClientUpdateFeedback } from '../../hooks/useClientUpdateFeedback';

/** Additive sancti.fi identity above Substreamer's untouched version footer. */
export function SanctifiVersionLabel() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const showUpdate = useClientUpdateFeedback();
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
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('clientUpdateCheck')}
        accessibilityState={{ busy: checking, disabled: checking }}
        disabled={checking}
        onPress={checkForUpdates}
      >
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {`sancti.fi client Version ${SANCTIFI_VERSION}`}
        </Text>
      </Pressable>
      <Text style={[styles.basedOn, { color: colors.textSecondary }]}>Based on Substreamer</Text>
      {message !== null && (
        <Text accessibilityLiveRegion="polite" style={[styles.version, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
  basedOn: {
    fontSize: 12,
    textAlign: 'center',
  },
});
