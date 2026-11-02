import Ionicons from "@react-native-vector-icons/ionicons/static";
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useBookmarkAction } from '../hooks/useBookmarkAction';
import { useTheme } from '../hooks/useTheme';
import { playerStore } from '../store/playerStore';

export interface BookmarkButtonProps {
  size?: number;
  /** Container padding/spacing — varies per player surface. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Saves a play-queue bookmark. Auto-names and commits immediately when the
 * auto-name preference is on; otherwise opens the manual-name sheet. Shared
 * across player surfaces.
 */
export const BookmarkButton = memo(function BookmarkButton({
  size = 24,
  style,
}: BookmarkButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queueLength = playerStore((s) => s.queue.length);
  const disabled = queueLength === 0;

  const handlePress = useBookmarkAction();

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('addBookmark')}
      style={({ pressed }) => [
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name="bookmark-outline" size={size} color={colors.textSecondary} />
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
