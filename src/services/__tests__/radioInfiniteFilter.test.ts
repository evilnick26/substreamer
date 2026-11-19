import type { Child } from 'subsonic-api';

import { filterRadioInfiniteRecommendations } from '../radioInfiniteFilter';

function song(id: string, overrides: Partial<Child> = {}): Child {
  return {
    id,
    isDir: false,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    album: `Album ${id}`,
    duration: 180,
    ...overrides,
  };
}

function acceptedIds(queue: Child[], candidates: Child[]): string[] {
  return filterRadioInfiniteRecommendations(queue, candidates).map((item) => item.id);
}

describe('Radio Infinite recommendation filtering (#077)', () => {
  it('rejects an ID already anywhere in the queue', () => {
    const queue = [song('existing'), song('tail')];
    expect(acceptedIds(queue, [song('existing'), song('new')])).toEqual(['new']);
  });

  it('rejects the same artist and complete title even with a different ID', () => {
    const queue = [song('first', { artist: 'Pulp', title: 'Common People' }), song('tail')];
    const candidates = [song('copy', { artist: '  PULP ', title: ' common   people ' })];
    expect(acceptedIds(queue, candidates)).toEqual([]);
  });

  it('allows the same title by a different artist', () => {
    const queue = [song('first', { artist: 'Pulp', title: 'Common People' })];
    expect(acceptedIds(queue, [song('other', { artist: 'Another Artist', title: 'Common People' })]))
      .toEqual(['other']);
  });

  it('preserves complete title qualifiers such as Live and Remix', () => {
    const queue = [song('original', { artist: 'Pulp', title: 'Common People' })];
    const candidates = [
      song('live', { artist: 'Pulp', title: 'Common People (Live)' }),
      song('remix', { artist: 'Pulp', title: 'Common People (Remix)' }),
    ];
    // The titles are distinct, but adjacent tracks by Pulp are still disallowed.
    // A different artist between them allows the second Pulp recording.
    candidates.splice(1, 0, song('interlude', { artist: 'Other Artist' }));
    expect(acceptedIds(queue, candidates)).toEqual(['interlude', 'remix']);
  });

  it('rejects consecutive tracks with the same primary artist', () => {
    const queue = [song('tail', { artist: 'Pulp' })];
    expect(acceptedIds(queue, [
      song('same', { artist: ' pulp ' }),
      song('different', { artist: 'Blur' }),
    ])).toEqual(['different']);
  });

  it('rejects consecutive tracks sharing album artist and album', () => {
    const queue = [song('tail', {
      artist: 'Singer One', album: 'Shared Album',
      albumArtists: [{ id: 'aa', name: 'Shared Album Artist', albumCount: 0 }],
    })];
    expect(acceptedIds(queue, [song('same-album', {
      artist: 'Singer Two', album: ' shared  album ',
      albumArtists: [{ id: 'aa', name: 'shared album artist', albumCount: 0 }],
    })])).toEqual([]);
  });

  it('rejects adjacent tracks on the same Various Artists compilation', () => {
    const queue = [song('tail', {
      artist: 'Band A', album: 'Compilation',
      albumArtists: [{ id: 'va', name: 'Various Artists', albumCount: 0 }],
    })];
    expect(acceptedIds(queue, [song('next', {
      artist: 'Band B', album: 'Compilation',
      albumArtists: [{ id: 'va', name: 'Various Artists', albumCount: 0 }],
    })])).toEqual([]);
  });

  it('uses the last accepted track, not the last rejected candidate, for adjacency', () => {
    const queue = [song('tail', { artist: 'Pulp' })];
    const candidates = [
      song('rejected', { artist: 'Pulp' }),
      song('accepted', { artist: 'Blur' }),
      song('rejected-again', { artist: 'Blur' }),
      song('accepted-again', { artist: 'Suede' }),
    ];
    expect(acceptedIds(queue, candidates)).toEqual(['accepted', 'accepted-again']);
  });

  it('does not invent artist or album matches when optional metadata is missing', () => {
    const queue = [song('tail', { artist: undefined, album: undefined })];
    const candidates = [
      song('one', { artist: undefined, album: undefined }),
      song('two', { artist: undefined, album: undefined }),
    ];
    expect(acceptedIds(queue, candidates)).toEqual(['one', 'two']);
  });

  it('rejects duplicate IDs and song identities within the candidate batch', () => {
    const candidates = [
      song('one', { artist: 'Pulp', title: 'Common People' }),
      song('one', { artist: 'Pulp', title: 'Common People' }),
      song('two', { artist: 'Pulp', title: 'Common People' }),
      song('three', { artist: 'Blur', title: 'Song 2' }),
    ];
    expect(acceptedIds([], candidates)).toEqual(['one', 'three']);
  });

  it('falls back to displayAlbumArtist when structured album artists are absent', () => {
    const queue = [song('tail', {
      artist: 'Band A', album: 'Compilation', displayAlbumArtist: 'Various Artists',
    })];
    const candidates = [song('next', {
      artist: 'Band B', album: 'Compilation', displayAlbumArtist: 'Various Artists',
    })];
    expect(acceptedIds(queue, candidates)).toEqual([]);
  });


  it('accepts at most ten valid candidates from a twenty-song batch, in order', () => {
    const queue = [song('tail')];
    const candidates = Array.from({ length: 20 }, (_, i) => song(`candidate-${i}`));
    expect(acceptedIds(queue, candidates)).toEqual(
      Array.from({ length: 10 }, (_, i) => `candidate-${i}`),
    );
    expect(candidates).toHaveLength(20);
  });

  it('continues past rejected candidates until ten eligible songs are found', () => {
    const queue = [song('tail')];
    const candidates = [
      song('tail'), // Already in queue: does not consume a slot.
      song('candidate-0'),
      song('candidate-0'), // Duplicate ID: does not consume a slot.
      ...Array.from({ length: 9 }, (_, i) => song(`candidate-${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => song(`unused-${i}`)),
    ];
    expect(candidates).toHaveLength(20);
    expect(acceptedIds(queue, candidates)).toEqual(
      Array.from({ length: 10 }, (_, i) => `candidate-${i}`),
    );
  });

  it('preserves candidate order without modifying its inputs', () => {
    const queue = [song('tail')];
    const candidates = [song('c'), song('a'), song('b')];
    expect(acceptedIds(queue, candidates)).toEqual(['c', 'a', 'b']);
    expect(queue.map((item) => item.id)).toEqual(['tail']);
    expect(candidates.map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  describe('duration eligibility (#086)', () => {
    it('accepts tracks exactly at both duration boundaries', () => {
      expect(acceptedIds([], [
        song('minimum', { duration: 90 }),
        song('maximum', { duration: 480 }),
      ])).toEqual(['minimum', 'maximum']);
    });

    it('rejects tracks outside the permitted duration range', () => {
      expect(acceptedIds([], [
        song('short', { duration: 89 }),
        song('valid', { duration: 180 }),
        song('long', { duration: 481 }),
      ])).toEqual(['valid']);
    });

    it('rejects missing, zero, negative and non-finite durations', () => {
      expect(acceptedIds([], [
        song('missing', { duration: undefined }),
        song('zero', { duration: 0 }),
        song('negative', { duration: -10 }),
        song('nan', { duration: NaN }),
        song('infinity', { duration: Infinity }),
        song('valid', { duration: 180 }),
      ])).toEqual(['valid']);
    });

    it('preserves order after rejecting tracks by duration', () => {
      expect(acceptedIds([], [
        song('short', { duration: 30 }),
        song('first', { duration: 120 }),
        song('long', { duration: 900 }),
        song('second', { duration: 240 }),
        song('third', { duration: 480 }),
      ])).toEqual(['first', 'second', 'third']);
    });

    it('does not let a rejected duration affect artist adjacency', () => {
      const queue = [song('tail', { artist: 'Pulp' })];
      expect(acceptedIds(queue, [
        song('short-blur', { artist: 'Blur', duration: 30 }),
        song('pulp', { artist: 'Pulp', duration: 180 }),
        song('blur', { artist: 'Blur', duration: 180 }),
      ])).toEqual(['blur']);
    });
  });
});
