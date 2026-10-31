import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/useTheme';
import { npsExperimentStore, type NpsOrientationMode } from '@/store/npsExperimentStore';
import { settingsStyles } from '@/styles/settingsStyles';
import { IS_TABLET } from '@/utils/deviceLayout';
import { SettingsSectionTitle } from './SettingsSectionTitle';

const OPTIONS: { mode: NpsOrientationMode; label: string }[] = [
  { mode: 'automatic', label: 'npsAutomaticRotation' },
  { mode: 'manual', label: 'npsManualLandscape' },
];

/** Temporary tester-facing preference; intentionally available in test release APKs. */
export function NpsExperimentCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mode = npsExperimentStore((s) => s.mode);
  const setMode = npsExperimentStore((s) => s.setMode);
  if (Platform.OS !== 'android' || IS_TABLET) return null;

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('npsExperimentTitle')}</SettingsSectionTitle>
      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{t('npsExperimentHint')}</Text>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === option.mode }}
            onPress={() => setMode(option.mode)}
            style={({ pressed }) => [styles.row, pressed && settingsStyles.pressed]}
          >
            <Text style={{ color: mode === option.mode ? colors.primary : colors.textPrimary }}>{t(option.label)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { padding: 16 } });
