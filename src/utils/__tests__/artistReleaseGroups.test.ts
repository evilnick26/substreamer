import type { AlbumID3 } from 'subsonic-api';

import { classifyArtistRelease, groupArtistReleases, type ArtistReleaseGroup } from '../artistReleaseGroups';

describe('classifyArtistRelease', () => {
  it.each<[string[] | undefined, ArtistReleaseGroup]>([
    [['Album'], 'albums'], [['EP'], 'eps'], [['single'], 'singles'],
    [['aLbUm'], 'albums'], [[' ep ', '\tSINGLE\n'], 'otherReleases'],
    [[' EP '], 'eps'], [[' Single\t'], 'singles'],
    [['Album', 'Live'], 'albums'], [['Compilation', 'EP'], 'eps'],
    [['Remix', 'Live', 'Compilation', 'Single'], 'singles'],
    [['EP', 'ep'], 'eps'], [['Album', 'album', 'ALBUM'], 'albums'],
    [['Album', 'Single'], 'otherReleases'], [['EP', 'Album'], 'otherReleases'],
    [['Compilation'], 'otherReleases'], [['Unrecognised'], 'otherReleases'],
    [['Album', 'Unrecognised'], 'albums'], [['album;live'], 'otherReleases'],
    [['', '  '], 'otherReleases'], [[], 'otherReleases'], [undefined, 'otherReleases'],
  ])('%j -> %s', (values, expected) => {
    expect(classifyArtistRelease(values)).toBe(expected);
  });
});

const album = (id: string, releaseTypes?: string[]): AlbumID3 => ({
  id, name: id, duration: 100, songCount: 2, coverArt: `art-${id}`, version: 'Deluxe', releaseTypes,
});

describe('groupArtistReleases', () => {
  it('orders nonempty sections and preserves every album once in its original section order', () => {
    const input = [album('s', ['Single']), album('a2', ['Album']), album('unknown'),
      album('ep', ['EP', 'Live']), album('a1', ['Album']), album('conflict', ['EP', 'Single'])];
    const before = JSON.stringify(input);
    input.forEach((a) => { if (a.releaseTypes) Object.freeze(a.releaseTypes); Object.freeze(a); });
    Object.freeze(input);
    const items = groupArtistReleases(input);
    expect(items.filter((i) => i.type === 'header').map((i) => i.group))
      .toEqual(['albums', 'eps', 'singles', 'otherReleases']);
    const albums = items.flatMap((i) => i.type === 'album' ? [i.album] : []);
    expect(albums.map((a) => a.id)).toEqual(['a2', 'a1', 'ep', 's', 'unknown', 'conflict']);
    expect(new Set(albums).size).toBe(input.length);
    albums.forEach((a) => expect(a).toBe(input.find((original) => original.id === a.id)));
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([['Album'], ['EP'], ['Single'], ['Other'], ['Album', 'EP'], ['EP', 'Single']])(
    'hides empty sections for %j', (...types) => {
      const items = groupArtistReleases(types.map((type, i) => album(String(i), [type])));
      const headers = items.filter((i) => i.type === 'header');
      expect(headers).toHaveLength(types.length);
      expect(items).toHaveLength(types.length * 2);
    },
  );

  it('has no headers for an empty artist', () => expect(groupArtistReleases([])).toEqual([]));
});
