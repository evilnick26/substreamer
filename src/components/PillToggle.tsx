import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '../constants/theme';

interface PillToggleOption<K extends string> {
  key: K;
  label: string;
}

interface PillToggleProps<K extends string> {
  options: readonly PillToggleOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
  colors: ThemeColors;
}

function PillToggleInner<K extends string>({
  options,
  selected,
  onSelect,
  colors,
}: PillToggleProps<K>) {
  return (
    <View style={[styles.container, { backgroundColor: colors.inputBg }]}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onSelect(option.key)}
          style={[
            styles.half,
            selected === option.key && { backgroundColor: colors.primary },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === option.key }}
        >
          <Text
            style={[
              styles.label,
              selected === option.key
                ? styles.labelActive
                : { color: colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const PillToggle = memo(PillToggleInner) as typeof PillToggleInner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },
  half: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
