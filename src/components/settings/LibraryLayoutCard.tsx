import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';
import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { normalizeLibraryOrder, type LibrarySegment } from '../../constants/libraryNavigation';
import { useTheme } from '../../hooks/useTheme';
import { settingsStyles } from '../../styles/settingsStyles';
import { layoutPreferencesStore, type ItemLayout } from '../../store/layoutPreferencesStore';
import { SettingsSectionTitle } from './SettingsSectionTitle';

const ROW_HEIGHT = 54;
const ROWS: Record<LibrarySegment, { layoutKey: 'songLayout' | 'albumLayout' | 'artistLayout' | 'playlistLayout' }> = {
  songs: { layoutKey: 'songLayout' },
  albums: { layoutKey: 'albumLayout' },
  artists: { layoutKey: 'artistLayout' },
  playlists: { layoutKey: 'playlistLayout' },
};

function SortableLayoutRow({
  id, index, layout, setLayout, onMove, onDragActive,
}: {
  id: LibrarySegment;
  index: number;
  layout: ItemLayout;
  setLayout: (layout: ItemLayout) => void;
  onMove: (from: number, to: number) => void;
  onDragActive: (active: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const latest = useRef({ index, onMove, onDragActive });
  latest.current = { index, onMove, onDragActive };
  const [dragging, setDragging] = useState(false);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      latest.current.onDragActive(true);
      setDragging(true);
      offset.setValue(0);
    },
    onPanResponderMove: (_, gesture) => offset.setValue(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      const from = latest.current.index;
      const to = Math.max(0, Math.min(3, from + Math.round(gesture.dy / ROW_HEIGHT)));
      offset.setValue(0);
      setDragging(false);
      latest.current.onDragActive(false);
      if (from !== to) latest.current.onMove(from, to);
    },
    onPanResponderTerminate: () => {
      offset.setValue(0);
      setDragging(false);
      latest.current.onDragActive(false);
    },
  }), [offset]);

  return (
    <Animated.View style={[
      styles.row,
      { backgroundColor: colors.card, borderColor: colors.border },
      dragging && { zIndex: 10, elevation: 6, opacity: 0.92, transform: [{ translateY: offset }] },
    ]}>
      <View {...responder.panHandlers} style={styles.dragHandle} accessibilityLabel={`Reorder ${t(id)}`} accessibilityRole="adjustable">
        <MaterialCommunityIcons name="drag-vertical" size={24} color={colors.textSecondary} />
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{t(id)}</Text>
      <View style={styles.icons}>
        <Pressable onPress={() => setLayout('list')} hitSlop={8} style={({ pressed }) => pressed && settingsStyles.pressed}>
          <MaterialCommunityIcons name="view-list-outline" size={22} color={layout === 'list' ? colors.primary : colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => setLayout('grid')} hitSlop={8} style={({ pressed }) => pressed && settingsStyles.pressed}>
          <MaterialCommunityIcons name="view-grid-outline" size={22} color={layout === 'grid' ? colors.primary : colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function LibraryLayoutCard({ onDragActive = () => {} }: { onDragActive?: (active: boolean) => void }) {
  const { t } = useTranslation();
  const libraryOrder = layoutPreferencesStore((s) => s.libraryOrder);
  const setLibraryOrder = layoutPreferencesStore((s) => s.setLibraryOrder);
  const songLayout = layoutPreferencesStore((s) => s.songLayout);
  const albumLayout = layoutPreferencesStore((s) => s.albumLayout);
  const artistLayout = layoutPreferencesStore((s) => s.artistLayout);
  const playlistLayout = layoutPreferencesStore((s) => s.playlistLayout);
  const setSongLayout = layoutPreferencesStore((s) => s.setSongLayout);
  const setAlbumLayout = layoutPreferencesStore((s) => s.setAlbumLayout);
  const setArtistLayout = layoutPreferencesStore((s) => s.setArtistLayout);
  const setPlaylistLayout = layoutPreferencesStore((s) => s.setPlaylistLayout);

  const values = { songLayout, albumLayout, artistLayout, playlistLayout };
  const setters = { songLayout: setSongLayout, albumLayout: setAlbumLayout, artistLayout: setArtistLayout, playlistLayout: setPlaylistLayout };
  const order = normalizeLibraryOrder(libraryOrder);
  const move = (from: number, to: number) => {
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    setLibraryOrder(next);
  };

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('libraryLayout')}</SettingsSectionTitle>
      <View style={styles.card}>
        {order.map((id, index) => {
          const key = ROWS[id].layoutKey;
          return <SortableLayoutRow key={id} id={id} index={index} layout={values[key]} setLayout={setters[key]} onMove={move} onDragActive={onDragActive} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'visible' },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dragHandle: { width: 48, height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 16, flex: 1 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
