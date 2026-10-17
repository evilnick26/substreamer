import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useState } from 'react';
import { ScrollView } from 'react-native';

import { BottomChrome } from '../components/BottomChrome';
import { GradientBackground } from '../components/GradientBackground';
import { AccentColorCard } from '../components/settings/AccentColorCard';
import { AlbumSortOrderCard } from '../components/settings/AlbumSortOrderCard';
import { ArtistAlbumSortOrderCard } from '../components/settings/ArtistAlbumSortOrderCard';
import { ArtistPlayModeCard } from '../components/settings/ArtistPlayModeCard';
import { BookmarksCard } from '../components/settings/BookmarksCard';
import { DateFormatCard } from '../components/settings/DateFormatCard';
import { FavoritesLayoutCard } from '../components/settings/FavoritesLayoutCard';
import { FiltersCard } from '../components/settings/FiltersCard';
import { LanguageCard } from '../components/settings/LanguageCard';
import { LibraryLayoutCard } from '../components/settings/LibraryLayoutCard';
import { ListLengthCard } from '../components/settings/ListLengthCard';
import { SongCoverArtCard } from '../components/settings/SongCoverArtCard';
import { AlbumVersionCard } from '../components/settings/AlbumVersionCard';
import { SongSortOrderCard } from '../components/settings/SongSortOrderCard';
import { ThemeCard } from '../components/settings/ThemeCard';
import { settingsStyles } from '../styles/settingsStyles';

export function SettingsAppearanceScreen() {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const [libraryDragging, setLibraryDragging] = useState(false);

  return (
    <GradientBackground scrollable>
      <ScrollView
        scrollEnabled={!libraryDragging}
        style={settingsStyles.container}
        contentContainerStyle={[settingsStyles.content, { paddingTop: headerHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemeCard />
        <AccentColorCard />
        <BookmarksCard />
        <LanguageCard />
        <AlbumSortOrderCard />
        <SongSortOrderCard />
        <ArtistAlbumSortOrderCard />
        <DateFormatCard />
        <SongCoverArtCard />
        <AlbumVersionCard />
        <ListLengthCard />
        <ArtistPlayModeCard />
        <FiltersCard />
        <LibraryLayoutCard onDragActive={setLibraryDragging} />
        <FavoritesLayoutCard />
      </ScrollView>
      <BottomChrome withSafeAreaPadding />
    </GradientBackground>
  );
}
