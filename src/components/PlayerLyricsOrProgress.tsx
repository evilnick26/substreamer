import { useMemo, type ReactNode } from 'react';

import { InlineLyricsPanel } from './InlineLyricsPanel';
import type { ThemeColors } from '../constants/theme';
import type { LyricsData } from '../services/subsonicService';
import { layoutPreferencesStore } from '../store/layoutPreferencesStore';
import { isInlineLyricsEligible } from '../utils/lyrics';

export function PlayerLyricsOrProgress({ trackId, lyrics, colors, visible, children }: {
  trackId: string;
  lyrics: LyricsData | undefined;
  colors: ThemeColors;
  visible?: boolean;
  children: ReactNode;
}) {
  const enabled = layoutPreferencesStore((s) => s.displaySyncedLyricsInNps);
  const eligible = useMemo(() => isInlineLyricsEligible(lyrics) ? lyrics : null, [lyrics]);
  return enabled && eligible
    ? <InlineLyricsPanel trackId={trackId} lyrics={eligible} colors={colors} visible={visible} />
    : <>{children}</>;
}
