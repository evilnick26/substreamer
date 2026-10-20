import { resolveArtworkAccent } from '../resolveArtworkAccent';

const old = { coverKey: 'a|1', palette: { dark: '#223344', light: '#ddeeff' } };
const fresh = { coverKey: 'b|2', palette: { dark: '#445566', light: '#aabbcc' } };
const unusable = { coverKey: 'b|2', palette: null };
const BLUE = '#1D9BF0';

describe('artwork accent transition policy', () => {
  it('uses Blue before any artwork has resolved', () => {
    expect(resolveArtworkAccent('artwork', null, 'a|1', 'dark')).toBe(BLUE);
  });
  it('retains the last good accent while the next cover is pending', () => {
    expect(resolveArtworkAccent('artwork', old, 'b|2', 'dark')).toBe('#223344');
    expect(resolveArtworkAccent('artwork', old, 'b|2', 'light')).toBe('#ddeeff');
  });
  it('replaces the previous accent when the current palette arrives', () => {
    expect(resolveArtworkAccent('artwork', fresh, 'b|2', 'dark')).toBe('#445566');
  });
  it('uses Blue for an explicitly unusable current palette', () => {
    expect(resolveArtworkAccent('artwork', unusable, 'b|2', 'dark')).toBe(BLUE);
  });
  it('uses Blue when there is no current artwork, even if old colours remain', () => {
    expect(resolveArtworkAccent('artwork', old, null, 'dark')).toBe(BLUE);
  });
  it('does not retain an unusable previous palette', () => {
    expect(resolveArtworkAccent('artwork', { coverKey: 'a|1', palette: null }, 'b|2', 'dark')).toBe(BLUE);
  });
  it('applies static accents immediately and preserves the default null selection', () => {
    expect(resolveArtworkAccent('#ff0099', old, 'b|2', 'dark')).toBe('#ff0099');
    expect(resolveArtworkAccent(null, old, 'b|2', 'dark')).toBeNull();
  });
});
