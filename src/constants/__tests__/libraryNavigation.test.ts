import { DEFAULT_LIBRARY_ORDER, normalizeLibraryOrder } from '../libraryNavigation';

describe('normalizeLibraryOrder', () => {
  it('uses the original Library order when no preference exists', () => {
    expect(normalizeLibraryOrder(undefined)).toEqual([
      'songs', 'albums', 'artists', 'playlists',
    ]);
    expect(normalizeLibraryOrder(undefined)).toEqual([...DEFAULT_LIBRARY_ORDER]);
  });

  it('preserves a complete custom order', () => {
    expect(normalizeLibraryOrder(['playlists', 'artists', 'albums', 'songs'])).toEqual([
      'playlists', 'artists', 'albums', 'songs',
    ]);
  });

  it('removes duplicate entries while preserving their first occurrence', () => {
    expect(normalizeLibraryOrder(['artists', 'songs', 'artists', 'albums', 'playlists'])).toEqual([
      'artists', 'songs', 'albums', 'playlists',
    ]);
  });

  it('ignores unknown identifiers', () => {
    expect(normalizeLibraryOrder(['playlists', 'invalid', 'artists', 'albums', 'songs'])).toEqual([
      'playlists', 'artists', 'albums', 'songs',
    ]);
  });

  it('appends missing entries in their original default order', () => {
    expect(normalizeLibraryOrder(['playlists', 'artists'])).toEqual([
      'playlists', 'artists', 'songs', 'albums',
    ]);
  });

  it.each([null, 42, 'songs', {}, [null, 123, {}, 'albums']])(
    'handles malformed saved preferences: %p',
    (value) => {
      const result = normalizeLibraryOrder(value);
      expect(result).toHaveLength(DEFAULT_LIBRARY_ORDER.length);
      expect(new Set(result).size).toBe(DEFAULT_LIBRARY_ORDER.length);
      expect(result).toEqual(expect.arrayContaining([...DEFAULT_LIBRARY_ORDER]));
    },
  );
});
