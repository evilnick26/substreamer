import Ionicons from "@react-native-vector-icons/ionicons/static";
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { playMoreLikeThis } from '../services/moreOptionsService';
import { offlineModeStore } from '../store/offlineModeStore';
import { playerStore } from '../store/playerStore';

export interface PlayMoreLikeThisButtonProps {
  size?: number;
  /** Container padding/spacing — varies per player surface. */
  style?: StyleProp<ViewStyle>;
}

export const PlayMoreLikeThisButton = memo(function PlayMoreLikeThisButton({
  size = 24,
  style,
}: PlayMoreLikeThisButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentTrack = playerStore((s) => s.currentTrack);
  const offline = offlineModeStore((s) => s.offlineMode);
  const disabled = !currentTrack || offline;

  const handlePress = useCallback(() => {
    if (currentTrack && !offline) void playMoreLikeThis(currentTrack);
  }, [currentTrack, offline]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={t('playMoreLikeThis')}
      style={({ pressed }) => [
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name="radio-outline" size={size} color={colors.textSecondary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
