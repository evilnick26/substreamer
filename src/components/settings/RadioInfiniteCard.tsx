import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { settingsStyles } from '../../styles/settingsStyles';
import { playbackSettingsStore } from '../../store/playbackSettingsStore';
import { DropdownRow, type DropdownOption } from './DropdownRow';
import { SettingsSectionTitle } from './SettingsSectionTitle';

type OfflineFallback = 'all' | 'off';

/** Offline Mode's persistent fallback for Radio Infinite; no native call needed. */
export function RadioInfiniteCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const fallback = playbackSettingsStore((s) => s.radioOfflineFallback);
  const setFallback = playbackSettingsStore((s) => s.setRadioOfflineFallback);

  const options: DropdownOption<OfflineFallback>[] = useMemo(() => [
    { value: 'all', label: t('radioInfiniteFallbackAll') },
    { value: 'off', label: t('radioInfiniteFallbackOff') },
  ], [t]);

  const onChange = useCallback((value: OfflineFallback) => setFallback(value), [setFallback]);

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('radioInfiniteSettings')}</SettingsSectionTitle>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('radioInfiniteOfflineFallbackLabel')}</Text>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        <DropdownRow
          label={t('radioInfiniteFallbackDropdownLabel')}
          value={fallback}
          options={options}
          onChange={onChange}
          isLast
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginHorizontal: 4,
  },
});
