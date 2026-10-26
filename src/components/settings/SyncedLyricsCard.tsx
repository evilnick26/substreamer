import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../hooks/useTheme';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { settingsStyles } from '../../styles/settingsStyles';

export function SyncedLyricsCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const enabled = layoutPreferencesStore((s) => s.displaySyncedLyricsInNps);
  const setEnabled = layoutPreferencesStore((s) => s.setDisplaySyncedLyricsInNps);
  return (
    <View style={settingsStyles.section}>
      <View style={[settingsStyles.card, styles.row, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t('displaySyncedLyricsInNps')}</Text>
        <Switch accessibilityLabel={t('displaySyncedLyricsInNps')} value={enabled} onValueChange={setEnabled}
          trackColor={{ false: colors.border, true: colors.primary }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  label: { flex: 1, fontSize: 16 },
});
