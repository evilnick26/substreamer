import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { settingsStyles } from '../../styles/settingsStyles';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { SettingsSectionTitle } from './SettingsSectionTitle';

export function AlbumVersionCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const value = layoutPreferencesStore((s) => s.showAlbumVersion);
  const setValue = layoutPreferencesStore((s) => s.setShowAlbumVersion);

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('nowPlayingDisplay')}</SettingsSectionTitle>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t('showAlbumVersion')}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('showAlbumVersionHint')}
            </Text>
          </View>
          <Switch
            testID="show-album-version-switch"
            accessibilityLabel={t('showAlbumVersion')}
            value={value}
            onValueChange={setValue}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 16,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 16 },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 16 },
});
