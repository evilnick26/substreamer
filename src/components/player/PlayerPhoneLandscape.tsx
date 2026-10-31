import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookmarkButton } from '@/components/BookmarkButton';
import { CachedImage } from '@/components/CachedImage';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PlaybackRateButton } from '@/components/PlaybackRateButton';
import { PlaybackSourceBadge } from '@/components/PlaybackSourceBadge';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { RepeatButton } from '@/components/RepeatButton';
import { CastButton } from '@/components/RoutePicker';
import { ShuffleButton } from '@/components/ShuffleButton';
import { SkipIntervalButton } from '@/components/SkipIntervalButton';
import { SleepTimerButton } from '@/components/SleepTimerButton';
import { SleepTimerCapsule } from '@/components/SleepTimerCapsule';
import { useCanSkip } from '@/hooks/useCanSkip';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { useTheme } from '@/hooks/useTheme';
import { retryPlayback, skipToNext, skipToPrevious, togglePlayPause } from '@/services/playerService';
import type { Child } from '@/services/subsonicService';
import { playbackSettingsStore } from '@/store/playbackSettingsStore';
import { playerStore } from '@/store/playerStore';

interface PlayerPhoneLandscapeProps {
  currentTrack: Child;
  queueLoading: boolean;
  handleSeek: (seconds: number) => void;
  handleShuffle: () => void;
  shuffling: boolean;
}

/** Phone landscape player tab; lyrics remain available only through their own tab. */
export function PlayerPhoneLandscape({
  currentTrack, queueLoading, handleSeek, handleShuffle, shuffling,
}: PlayerPhoneLandscapeProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isPlaying, isBuffering } = usePlaybackState();
  const { canSkipNext, canSkipPrevious } = useCanSkip();
  const position = playerStore((s) => s.position);
  const duration = playerStore((s) => s.duration);
  const bufferedPosition = playerStore((s) => s.bufferedPosition);
  const error = playerStore((s) => s.error);
  const retrying = playerStore((s) => s.retrying);
  const queueLength = playerStore((s) => s.queue.length);
  const showSkipInterval = playbackSettingsStore((s) => s.showSkipIntervalButtons);
  const showSleepTimer = playbackSettingsStore((s) => s.showSleepTimerButton);
  const [artSize, setArtSize] = useState(0);

  if (queueLoading) return <ActivityIndicator style={styles.loading} color={colors.textSecondary} />;

  return (
    <View testID="phone-landscape-player" style={styles.container}>
      <View
        style={styles.artColumn}
        onLayout={({ nativeEvent: { layout } }) => setArtSize(Math.floor(Math.max(0, Math.min(layout.width, layout.height))))}
      >
        {artSize > 0 && (
          <View style={[styles.artwork, { width: artSize, height: artSize }]}>
            <CachedImage
              coverArtId={currentTrack.coverArt ?? undefined}
              albumId={currentTrack.albumId}
              size={600}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.source}><PlaybackSourceBadge /></View>
          </View>
        )}
      </View>
      <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{currentTrack.title}</Text>
        <Text style={{ color: colors.textSecondary }} numberOfLines={1}>{currentTrack.artist ?? t('unknownArtist')}</Text>
        <Text style={{ color: colors.textSecondary }} numberOfLines={1}>{currentTrack.album}</Text>
        <PlayerProgressBar
          position={position} duration={duration} bufferedPosition={bufferedPosition}
          colors={colors} onSeek={handleSeek} isBuffering={isBuffering}
          error={error} retrying={retrying} onRetry={retryPlayback}
        />
        <View style={styles.controls}>
          <ShuffleButton onPress={handleShuffle} disabled={shuffling || queueLength < 2} size={24} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('previousTrack')} disabled={!canSkipPrevious} onPress={skipToPrevious} style={styles.button}>
            <Ionicons name="play-back" size={28} color={canSkipPrevious ? colors.textPrimary : colors.textSecondary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t(isPlaying ? 'pause' : 'play')} onPress={togglePlayPause} style={[styles.play, { backgroundColor: colors.textPrimary }]}>
            {isBuffering ? <ActivityIndicator color={colors.background} /> : <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={colors.background} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('nextTrack')} disabled={!canSkipNext} onPress={skipToNext} style={styles.button}>
            <Ionicons name="play-forward" size={28} color={canSkipNext ? colors.textPrimary : colors.textSecondary} />
          </Pressable>
          <RepeatButton size={24} />
        </View>
        <View style={styles.extras}>
          <FavoriteButton trackId={currentTrack.id} />
          <BookmarkButton />
          <PlaybackRateButton />
          {showSleepTimer && <SleepTimerButton />}
          {showSkipInterval && <SkipIntervalButton direction="backward" size={28} />}
          {showSkipInterval && <SkipIntervalButton direction="forward" size={28} />}
          <CastButton />
          <SleepTimerCapsule />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  container: { flex: 1, flexDirection: 'row', padding: 8, gap: 16 },
  artColumn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artwork: { borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  source: { position: 'absolute', right: 8, bottom: 8 },
  details: { flex: 1.4 },
  detailsContent: { flexGrow: 1, justifyContent: 'center', gap: 8, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  extras: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
});
