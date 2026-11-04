import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInstance } from 'i18next';

const localesDir = join(__dirname, '../locales');
const bundles = Object.fromEntries(readdirSync(localesDir).filter((file) => file.endsWith('.json'))
  .map((file) => [file.replace('.json', ''), JSON.parse(readFileSync(join(localesDir, file), 'utf8')) as Record<string, string>]));

const placeholders = (value: string) => (value.match(/\{\{\w+\}\}/g) ?? []).sort();

it.each(Object.keys(bundles))('%s separates release collections, classifications and unknown-title fallbacks', (locale) => {
  const values = bundles[locale];
  for (const key of ['releases', 'albums', 'unknownRelease', 'unknownAlbum', 'albumCount_other', 'playlistCount_other']) {
    expect(values[key]).toBeTruthy();
  }
  expect(values.releases).not.toBe(values.albums);
  expect(values.unknownRelease).not.toBe(values.unknownAlbum);
  expect(placeholders(values.downloadFullLibraryConfirmBody)).toEqual(['{{albums}}', '{{playlists}}']);
  for (const [key, value] of Object.entries(values)) {
    if (/album|release|playlistCount/i.test(key) || key === 'searchForEntity') {
      expect({ [key]: placeholders(value) }).toEqual({ [key]: placeholders(bundles.en[key]) });
    }
  }
});

it.each([0, 1, 2])('renders %i releases and playlists with independent English plural rules', async (count) => {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: bundles.en } }, interpolation: { escapeValue: false } });
  const releases = i18n.t('albumCount', { count });
  const playlists = i18n.t('playlistCount', { count });
  expect(releases).toBe(`${count} ${count === 1 ? 'release' : 'releases'}`);
  expect(playlists).toBe(`${count} ${count === 1 ? 'playlist' : 'playlists'}`);
  expect(i18n.t('downloadFullLibraryConfirmBody', { albums: releases, playlists }))
    .toContain(`${releases} and ${playlists}`);
});

it('keeps conventional English metadata, artwork and ReplayGain names', () => {
  expect(bundles.en.albums).toBe('Albums');
  expect(bundles.en.eps).toBe('EPs');
  expect(bundles.en.singles).toBe('Singles');
  expect(bundles.en.detailAlbum).toBe('Album');
  expect(bundles.en.detailAlbumArtist).toBe('Album Artist');
  expect(bundles.en.colorAlbumArtwork).toBe('Album Artwork');
  expect(bundles.en.replayGainModeAlbum).toBe('Album');
  expect(bundles.en.clientUpdateDownload).toBe('Download');
});

it.each([
  ['ru', /альбом/iu],
  ['zh-Hans', /专辑/u],
  ['zh-Hant', /專輯/u],
] as const)('%s share messages describe generic releases without an Album noun', async (locale, albumNoun) => {
  const i18n = createInstance();
  await i18n.init({ lng: locale, resources: { [locale]: { translation: bundles[locale] } }, interpolation: { escapeValue: false } });
  for (const key of ['shareMessageAlbum', 'shareMessageAlbumWithArtist']) {
    const template = bundles[locale][key];
    expect(template).not.toMatch(albumNoun);
    expect(placeholders(template)).toEqual(key === 'shareMessageAlbum'
      ? ['{{album}}'] : ['{{album}}', '{{artist}}']);
    const message = i18n.t(key, { album: 'Example EP', artist: 'Example Artist' });
    expect(message).toContain('Example EP');
    if (key === 'shareMessageAlbumWithArtist') expect(message).toContain('Example Artist');
    expect(message).not.toContain('{{');
  }
});

it.each([
  ['ja', /リリース/u, /タップ/u, /ボタン/u],
  ['id', /rilis/u, /Ketuk/u, /tombol/u],
  ['ko', /발매작/u, /눌러/u, /버튼/u],
  ['ms', /keluaran/u, /Ketik/u, /butang/u],
  ['nl', /uitgave/u, /Tik/u, /knop/u],
  ['uk', /реліз/u, /Натисніть/u, /кнопку/u],
] as const)('%s joins localized offline guidance around the download icon', (locale, release, tap, button) => {
  const before = bundles[locale].noDownloadedMusicHintBefore;
  const after = bundles[locale].noDownloadedMusicHintAfter;
  const message = `${before} [download] ${after}`;
  expect(before.trim()).not.toBe('');
  expect(after.trim()).not.toBe('');
  expect(message).toMatch(release);
  expect(message).toMatch(tap);
  expect(message).toMatch(button);
  expect(message).not.toMatch(/Tap the|アルバム/u);
  expect(message.split('[download]')).toHaveLength(2);
  expect(placeholders(before)).toEqual([]);
  expect(placeholders(after)).toEqual([]);
});

it.each([
  ['ru', [0, 1, 2, 5, 21], ['0 релизов', '1 релиз', '2 релиза', '5 релизов', '21 релиз'],
    ['0 плейлистов', '1 плейлист', '2 плейлиста', '5 плейлистов', '21 плейлист']],
  ['fr', [0, 1, 2], ['0 sortie', '1 sortie', '2 sorties'], ['0 playlist', '1 playlist', '2 playlists']],
  ['ja', [0, 1, 2], ['0件のリリース', '1件のリリース', '2件のリリース'],
    ['0件のプレイリスト', '1件のプレイリスト', '2件のプレイリスト']],
] as const)('%s selects representative non-English count forms in download confirmations', async (locale, counts, releaseForms, playlistForms) => {
  const i18n = createInstance();
  await i18n.init({ lng: locale, resources: { [locale]: { translation: bundles[locale] } }, interpolation: { escapeValue: false } });
  counts.forEach((count, index) => {
    const albums = i18n.t('albumCount', { count });
    const playlists = i18n.t('playlistCount', { count });
    expect(albums).toBe(releaseForms[index]);
    expect(playlists).toBe(playlistForms[index]);
    const message = i18n.t('downloadFullLibraryConfirmBody', { albums, playlists });
    expect(message).toContain(albums);
    expect(message).toContain(playlists);
    expect(message).not.toContain('{{');
  });
});
