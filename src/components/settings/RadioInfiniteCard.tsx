import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { settingsStyles } from '../../styles/settingsStyles';
import { playbackSettingsStore } from '../../store/playbackSettingsStore';
import {
  DEFAULT_RADIO_MIN_DURATION,
  DEFAULT_RADIO_MAX_DURATION,
  RADIO_MIN_DURATION_OPTIONS,
  RADIO_MAX_DURATION_OPTIONS,
} from '../../services/radioInfiniteDuration';
import { DropdownRow, type DropdownOption } from './DropdownRow';
import { SettingsSectionTitle } from './SettingsSectionTitle';

type OfflineFallback = 'all' | 'off';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Persistent Radio Infinite preferences (#77, #95). */
export function RadioInfiniteCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const fallback = playbackSettingsStore((s) => s.radioOfflineFallback);
  const setFallback = playbackSettingsStore((s) => s.setRadioOfflineFallback);

  const minDuration = playbackSettingsStore((s) => s.radioMinDuration);
  const maxDuration = playbackSettingsStore((s) => s.radioMaxDuration);
  const setMinDuration = playbackSettingsStore((s) => s.setRadioMinDuration);
  const setMaxDuration = playbackSettingsStore((s) => s.setRadioMaxDuration);
  const resetDurationLimits = playbackSettingsStore((s) => s.resetRadioDurationLimits);

  const options: DropdownOption<OfflineFallback>[] = useMemo(() => [
    { value: 'all', label: t('radioInfiniteFallbackAll') },
    { value: 'off', label: t('radioInfiniteFallbackOff') },
  ], [t]);

  const onChange = useCallback(
    (value: OfflineFallback) => setFallback(value),
    [setFallback],
  );

  const minOptions: DropdownOption<number>[] = useMemo(() => {
    const values = [...new Set<number>([
      ...RADIO_MIN_DURATION_OPTIONS,
      minDuration,
    ])].sort((a, b) => a - b);

    return values
      .filter((value) => maxDuration === null || value <= maxDuration)
      .map((value) => ({
        value,
        label: value === 0
          ? t('radioInfiniteNoMinimum')
          : formatDuration(value),
      }));
  }, [minDuration, maxDuration, t]);

  const maxOptions: DropdownOption<number | null>[] = useMemo(() => {
    const values = [...new Set<number | null>([
      ...RADIO_MAX_DURATION_OPTIONS,
      maxDuration,
    ])];

    return values
      .filter((value) => value === null || value >= minDuration)
      .sort((a, b) => {
        if (a === b) return 0;
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      })
      .map((value) => ({
        value,
        label: value === null
          ? t('radioInfiniteNoMaximum')
          : formatDuration(value),
      }));
  }, [minDuration, maxDuration, t]);

  const durationsAreDefault =
    minDuration === DEFAULT_RADIO_MIN_DURATION &&
    maxDuration === DEFAULT_RADIO_MAX_DURATION;

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('radioInfiniteSettings')}</SettingsSectionTitle>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('radioInfiniteOfflineFallbackLabel')}
      </Text>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        <DropdownRow
          label={t('radioInfiniteFallbackDropdownLabel')}
          value={fallback}
          options={options}
          onChange={onChange}
          isLast
        />
      </View>

      <Text style={[
        styles.hint,
        styles.durationHint,
        { color: colors.textSecondary },
      ]}>
        {t('radioInfiniteDurationHint')}
      </Text>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        <DropdownRow
          label={t('radioInfiniteMinDuration')}
          value={minDuration}
          options={minOptions}
          onChange={setMinDuration}
        />
        <DropdownRow
          label={t('radioInfiniteMaxDuration')}
          value={maxDuration}
          options={maxOptions}
          onChange={setMaxDuration}
          isLast
        />
      </View>

      {!durationsAreDefault && (
        <Pressable
          onPress={resetDurationLimits}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.reset,
            { borderColor: colors.border },
            pressed && settingsStyles.pressed,
          ]}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          <Text style={[styles.resetText, { color: colors.textPrimary }]}>
            {t('radioInfiniteResetDurations')}
          </Text>
        </Pressable>
      )}
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
  durationHint: {
    marginTop: 14,
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  resetText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
