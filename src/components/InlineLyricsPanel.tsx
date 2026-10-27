import { memo, useCallback, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ThemeColors } from '../constants/theme';
import { useAppActive } from '../hooks/useAppActive';
import type { LyricsData } from '../services/subsonicService';
import { playerStore } from '../store/playerStore';
import { findActiveLyricIndex } from '../utils/lyrics';

export const InlineLyricsPanel = memo(function InlineLyricsPanel({
  trackId, lyrics, colors, visible = true,
}: {
  trackId: string;
  lyrics: LyricsData;
  colors: ThemeColors;
  visible?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const active = useAppActive() && visible;
  const starts = useMemo(() => lyrics.lines.map((line) => line.startMs + lyrics.offsetMs), [lyrics]);
  const subscribe = useCallback((notify: () => void) => active
    ? playerStore.subscribe(notify) : () => {}, [active]);
  const snapshot = useCallback(() => {
    const state = playerStore.getState();
    if (state.currentTrack?.id !== trackId) return -2;
    const positionMs = state.position * 1000;
    const index = findActiveLyricIndex(starts, positionMs);
    // A distinct snapshot lets the anticipation boundary trigger a render.
    return index === -1 && positionMs < Math.max(0, starts[0] - 3000) ? -3 : index;
  }, [starts, trackId]);
  const index = useSyncExternalStore(subscribe, snapshot, snapshot);

  // Reserve two context lines, two current lines, padding and gaps.
  return (
    <View testID="inline-lyrics" style={[styles.panel, { minHeight: (20 + 44 + 20) * fontScale + 12 }]}>
      {(index === -3 ? [] : index === -1 ? [1] : [-1, 0, 1]).map((relative) => {
        const text = index === -2 ? '' : lyrics.lines[index + relative]?.text ?? '';
        const current = relative === 0;
        return (
          <Text
            key={relative}
            testID={current ? 'inline-lyrics-current' : relative < 0 ? 'inline-lyrics-previous' : 'inline-lyrics-next'}
            numberOfLines={current ? 2 : 1}
            accessibilityLabel={text}
            style={[styles.line, current ? styles.current : styles.context,
              { color: current ? colors.textPrimary : colors.textSecondary }]}
          >
            {text || '\u00a0'}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: { width: '100%', paddingVertical: 4, gap: 2, justifyContent: 'center' },
  line: { textAlign: 'center' },
  context: { fontSize: 14, lineHeight: 20 },
  current: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
});
