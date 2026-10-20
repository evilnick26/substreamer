import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

import { themeColors, type ResolvedTheme, type ThemeColors } from '../constants/theme';
import { themeStore } from '../store/themeStore';
import { resolveArtworkAccent } from '../utils/resolveArtworkAccent';
import { playerStore } from '../store/playerStore';

export function useTheme(): {
  theme: ResolvedTheme;
  colors: ThemeColors;
  preference: 'light' | 'dark' | 'system';
  primaryColor: string | null;
  setThemePreference: (p: 'light' | 'dark' | 'system') => void;
  setPrimaryColor: (color: string | null) => void;
} {
  const systemScheme = useColorScheme();
  const preference = themeStore((s) => s.themePreference);
  const setThemePreference = themeStore((s) => s.setThemePreference);
  const primaryColor = themeStore((s) => s.primaryColor);
  const setPrimaryColor = themeStore((s) => s.setPrimaryColor);
  const artworkAccent = themeStore((s) => s.artworkAccent);
  const currentCoverKey = playerStore((s) => {
    const track = s.currentTrack;
    return track?.coverArt ? `${track.coverArt}|${track.albumId ?? ""}` : null;
  });

  const theme: ResolvedTheme = useMemo(
    () => (preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference),
    [preference, systemScheme]
  );

  const colors: ThemeColors = useMemo(() => {
    const baseColors = themeColors[theme];
    const accent = resolveArtworkAccent(primaryColor, artworkAccent, currentCoverKey, theme);
    return accent ? { ...baseColors, primary: accent } : baseColors;
  }, [theme, primaryColor, artworkAccent, currentCoverKey]);

  return { theme, colors, preference, primaryColor, setPrimaryColor, setThemePreference };
}
