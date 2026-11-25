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
  // Presentation-only timing. These do not modify lyric timestamps.
  const GAP_MS = 9000;
  const HOLD_MS = 3000;
  const ANTICIPATION_MS = 3000;
  const FINAL_HOLD_MS = 5000;

  // Snapshot encoding:
  // >= 0: active lyric index
  // -1: first lyric anticipated; -2: wrong track
  // -3: before first anticipation; -4: lyrics temporarily blank
  // <= -10: anticipate lyric at index (-snapshot - 10)
  const snapshot = useCallback(() => {
    const state = playerStore.getState();
    if (state.currentTrack?.id !== trackId) return -2;

    const positionMs = state.position * 1000;
    const index = findActiveLyricIndex(starts, positionMs);

    if (index === -1) {
      return positionMs < Math.max(0, starts[0] - ANTICIPATION_MS)
        ? -3 : -1;
    }

    const next = index + 1;
    if (next >= starts.length) {
      return positionMs >= starts[index] + FINAL_HOLD_MS ? -4 : index;
    }

    const gap = starts[next] - starts[index];
    if (gap >= GAP_MS && positionMs >= starts[index] + HOLD_MS) {
      if (positionMs >= starts[next] - ANTICIPATION_MS) {
        return -(next + 10);
      }
      return -4;
    }

    return index;
  }, [starts, trackId]);
  const index = useSyncExternalStore(subscribe, snapshot, snapshot);

  // Reserve two context lines, two current lines, padding and gaps.
  return (
    <View testID="inline-lyrics" style={[styles.panel, { minHeight: (20 + 44 + 20) * fontScale + 12 }]}>
      {(index === -3 || index === -4 ? [] : index === -1 || index <= -10 ? [1] : [-1, 0, 1]).map((relative) => {
        const lyricIndex = index <= -10 ? -index - 10 : index + relative;
        // Do not preview a future lyric across a long instrumental gap.
        // It will appear at its own T-3s anticipation boundary instead.
        const distantNext = index >= 0 && relative === 1
          && lyricIndex < starts.length
          && starts[lyricIndex] - starts[index] >= GAP_MS;
        const distantPrevious = index >= 0 && relative === -1
          && lyricIndex >= 0
          && starts[index] - starts[lyricIndex] >= GAP_MS;
        const text = index === -2 || distantNext || distantPrevious
          ? '' : lyrics.lines[lyricIndex]?.text ?? '';
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
