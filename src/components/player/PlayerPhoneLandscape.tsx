import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { BookmarkButton } from '@/components/BookmarkButton';
import { CachedImage } from '@/components/CachedImage';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PlaybackSourceBadge } from '@/components/PlaybackSourceBadge';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { RepeatButton } from '@/components/RepeatButton';
import { ShuffleButton } from '@/components/ShuffleButton';
import { getAlbumVersion } from '@/db/repository/albums';
import { getDb } from '@/store/persistence/db';
import { layoutPreferencesStore } from '@/store/layoutPreferencesStore';
import { useCanSkip } from '@/hooks/useCanSkip';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { useTheme } from '@/hooks/useTheme';
import { retryPlayback, skipToNext, skipToPrevious, togglePlayPause } from '@/services/playerService';
import type { Child } from '@/services/subsonicService';
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
  const router = useRouter();
  const albumId = currentTrack.albumId ?? null;
  const artistId = currentTrack.artistId ?? null;
  const showAlbumVersion = layoutPreferencesStore((s) => s.showAlbumVersion);
  const [versionResult, setVersionResult] = useState<{ albumId: string; version: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    const db = albumId ? getDb() : null;
    if (db && albumId) {
      getAlbumVersion(db, albumId)
        .then((version) => { if (active) setVersionResult({ albumId, version }); })
        .catch(() => { if (active) setVersionResult({ albumId, version: null }); });
    }
    return () => { active = false; };
  }, [albumId]);
  const albumVersion = versionResult?.albumId === albumId ? versionResult.version : null;
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const compact = available.height > 0 && (available.height < 240 || available.width < 300);
  const { isPlaying, isBuffering } = usePlaybackState();
  const { canSkipNext, canSkipPrevious } = useCanSkip();
  const position = playerStore((s) => s.position);
  const duration = playerStore((s) => s.duration);
  const bufferedPosition = playerStore((s) => s.bufferedPosition);
  const error = playerStore((s) => s.error);
  const retrying = playerStore((s) => s.retrying);
  const queueLength = playerStore((s) => s.queue.length);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  // Reserve transport width and the column gap; use every remaining vertical pixel.
  const artSize = Math.max(0, Math.floor(Math.min(contentSize.height, contentSize.width - 220 - 12)));

  if (queueLoading) return <ActivityIndicator style={styles.loading} color={colors.textSecondary} />;

  return (
    <View testID="phone-landscape-player" style={styles.container}>
      <View testID="landscape-content-area" style={styles.body} onLayout={({ nativeEvent: { layout } }) => setContentSize({ width: layout.width, height: layout.height })}>
        <View style={[styles.artColumn, { width: artSize }]}>
          {artSize > 0 && (
            <View testID="landscape-artwork" style={[styles.artwork, { width: artSize, height: artSize, backgroundColor: colors.card }]}>
              <CachedImage
                coverArtId={currentTrack.coverArt ?? undefined}
                albumId={currentTrack.albumId}
                size={600}
                style={styles.image}
                resizeMode="contain"
              />
              <View style={styles.source}><PlaybackSourceBadge /></View>
            </View>
          )}
        </View>
        <View
          testID="landscape-details"
          style={styles.details}
          onLayout={({ nativeEvent: { layout } }) => setAvailable({ width: layout.width, height: layout.height })}
        >
          <ScrollView testID="landscape-metadata-scroll" style={styles.metadata} contentContainerStyle={styles.metadataContent}>
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: compact ? 16 : 18 }]} numberOfLines={compact ? 1 : 2}>{currentTrack.title}</Text>
            <Pressable testID="landscape-artist-link" accessibilityRole={artistId ? 'button' : undefined} accessibilityLabel={currentTrack.artist ?? undefined} disabled={!artistId} onPress={() => { if (artistId) router.push(`/artist/${artistId}`); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }} numberOfLines={1}>{currentTrack.artist ?? t('unknownArtist')}</Text>
            </Pressable>
            <Pressable testID="landscape-album-link" accessibilityRole={albumId ? 'button' : undefined} accessibilityLabel={currentTrack.album ?? undefined} disabled={!albumId} onPress={() => { if (albumId) router.push(`/album/${albumId}`); }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {currentTrack.year != null && currentTrack.year > 0 ? `(${currentTrack.year}) ${currentTrack.album ?? ''}` : currentTrack.album ?? ''}
              </Text>
              {showAlbumVersion && !!albumVersion && <Text testID="landscape-album-version" style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{albumVersion}</Text>}
            </Pressable>
            <PlayerProgressBar
              position={position} duration={duration} bufferedPosition={bufferedPosition}
              colors={colors} onSeek={handleSeek} isBuffering={isBuffering}
              error={error} retrying={retrying} onRetry={retryPlayback}
            />
          </ScrollView>
          <View testID="landscape-transport" style={styles.controls}>
            <ShuffleButton onPress={handleShuffle} disabled={shuffling || queueLength < 2} size={24} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('previousTrack')} disabled={!canSkipPrevious} onPress={skipToPrevious} style={styles.button}>
              <Ionicons name="play-back" size={28} color={canSkipPrevious ? colors.textPrimary : colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t(isPlaying ? 'pause' : 'play')} onPress={togglePlayPause} style={[styles.play, { backgroundColor: colors.textPrimary, width: compact ? 44 : 52, height: compact ? 44 : 52 }]}>
              {isBuffering ? <ActivityIndicator color={colors.background} /> : <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={colors.background} />}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('nextTrack')} disabled={!canSkipNext} onPress={skipToNext} style={styles.button}>
              <Ionicons name="play-forward" size={28} color={canSkipNext ? colors.textPrimary : colors.textSecondary} />
            </Pressable>
            <RepeatButton size={24} />
          </View>
          <View testID="landscape-secondary-row" style={styles.secondary}>
            <FavoriteButton trackId={currentTrack.id} style={styles.secondaryButton} />
            <BookmarkButton style={styles.secondaryButton} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 8, paddingVertical: 2 },
  body: { flex: 1, flexDirection: 'row', gap: 12 },
  artColumn: { alignItems: 'center', justifyContent: 'center' },
  artwork: { borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  source: { position: 'absolute', right: 8, bottom: 8 },
  details: { flex: 1, gap: 2 },
  metadata: { flex: 1 },
  metadataContent: { flexGrow: 1, justifyContent: 'center', gap: 2, paddingVertical: 2 },
  secondary: { flexShrink: 0, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 4 },
  secondaryButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexShrink: 0 },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
