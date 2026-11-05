import { formatPlayerAlbumLabel } from './playerAlbumLabel';

describe('formatPlayerAlbumLabel', () => {
  it.each([
    [2013, 'Fade', 'Deluxe Edition', '(2013) - Fade - Deluxe Edition'],
    [2013, 'Fade', null, '(2013) - Fade'],
    [null, 'Fade', 'Deluxe Edition', 'Fade - Deluxe Edition'],
    [null, 'Fade', null, 'Fade'],
    [2013, null, 'Deluxe Edition', '(2013) - Deluxe Edition'],
    [null, null, 'Deluxe Edition', 'Deluxe Edition'],
    [0, 'Fade', null, 'Fade'],
    [undefined, 'Fade', undefined, 'Fade'],
    [2013, '  Fade  ', '  Deluxe Edition  ', '(2013) - Fade - Deluxe Edition'],
    [null, null, null, ''],
  ])('formats year=%s album=%s version=%s', (year, album, version, expected) => {
    expect(formatPlayerAlbumLabel(year, album, version)).toBe(expected);
  });
});
