import { useIsFocused } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CachedImage } from '../components/CachedImage';
import { EmptyState } from '../components/EmptyState';
import { useTheme } from '../hooks/useTheme';
import { albumListsStore } from '../store/albumListsStore';
import { connectivityStore } from '../store/connectivityStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { searchStore } from '../store/searchStore';

export function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const focused = useIsFocused();
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const hasConnection = connectivityStore((s) => s.hasConnection);
  const offline = offlineMode || !hasConnection;
  const albums = albumListsStore((s) => s.recentlyAdded);
  const headerHeight = searchStore((s) => s.headerHeight);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!focused || offline) return;
    let active = true;
    setStatus('loading');
    albumListsStore.getState().refreshRecentlyAdded(20).then((success) => {
      if (active) setStatus(success ? 'ready' : 'error');
    });
    return () => { active = false; };
  }, [focused, offline, retry]);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: 24 }}>
      <Image
        source={require('../../assets/branding/sanctifi-horizontal-transparent.png')}
        accessibilityLabel="sancti.fi / Radio Infinite"
        resizeMode="contain"
        style={styles.logo}
      />
      <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('recentlyUploaded')}</Text>
      {offline ? (
        <Text style={[styles.notice, { color: colors.textSecondary }]}>{t('homeAlbumsOffline')}</Text>
      ) : status === 'loading' ? (
        <ActivityIndicator accessibilityLabel={t('loading')} color={colors.primary} />
      ) : status === 'error' ? (
        <View style={styles.notice}>
          <Text style={{ color: colors.textSecondary }}>{t('homeAlbumsError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}>
            <Text style={{ color: colors.primary }}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : albums.length === 0 ? (
        <EmptyState icon="albums-outline" title={t('homeAlbumsEmpty')} />
      ) : null}
      {albums.slice(0, 20).map((album) => (
        <Pressable
          key={album.id}
          accessibilityRole="button"
          onPress={() => router.push(`/album/${album.id}`)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
        >
          <CachedImage coverArtId={album.coverArt} size={150} style={styles.cover} resizeMode="cover" />
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.artist, { color: colors.textSecondary }]}>
              {album.artist ?? t('unknownArtist')}
            </Text>
            <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{album.name}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logo: { width: '90%', maxWidth: 420, aspectRatio: 1263 / 261, alignSelf: 'center', marginBottom: 24 },
  heading: { fontSize: 22, fontWeight: '600', marginHorizontal: 16, marginBottom: 12 },
  notice: { marginHorizontal: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  cover: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, marginLeft: 12 },
  artist: { fontSize: 14 },
  title: { fontSize: 16, fontWeight: '600', marginTop: 2 },
});
