import Ionicons from '@react-native-vector-icons/ionicons/static';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoreOptionsButton } from '@/components/MoreOptionsButton';
import { useTheme } from '@/hooks/useTheme';

export const PHONE_LANDSCAPE_HEADER_HEIGHT = 40;

export function PhoneLandscapeHeader({ onClose, onMore }: {
  onClose: () => void;
  onMore: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View testID="phone-landscape-header" style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onClose} style={styles.close} hitSlop={2}>
          <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{t('npsPlaying')}</Text>
        <MoreOptionsButton onPress={onMore} color={colors.textPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: PHONE_LANDSCAPE_HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 14, fontWeight: '600' },
});
