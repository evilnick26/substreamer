import { clearArtworkPaletteCacheForTests, getSharedArtworkPalette } from '../artworkPaletteService';

const mockExtract = jest.fn();
jest.mock('expo-image-colors', () => ({
  getImagePaletteAsync: (uri: string) => mockExtract(uri),
}));

const palette = {
  dark: { primary: '#123456', secondary: '#234567' },
  light: { primary: '#abcdef', secondary: '#bcdef0' },
};

beforeEach(() => {
  clearArtworkPaletteCacheForTests();
  mockExtract.mockReset();
});

it('shares a pending extraction and preserves all four colours', async () => {
  let resolve!: (value: typeof palette) => void;
  mockExtract.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const a = getSharedArtworkPalette('file:///a.jpg');
  const b = getSharedArtworkPalette('file:///a.jpg');
  expect(a).toBe(b);
  await Promise.resolve();
  expect(mockExtract).toHaveBeenCalledTimes(1);
  resolve(palette);
  expect(await a).toEqual(palette);
  expect(await b).toEqual(palette);
  expect(await getSharedArtworkPalette('file:///a.jpg')).toEqual(palette);
  expect(mockExtract).toHaveBeenCalledTimes(1);
});

it('re-extracts when the resolved URI changes', async () => {
  mockExtract.mockResolvedValue(palette);
  await getSharedArtworkPalette('file:///a.jpg');
  await getSharedArtworkPalette('file:///a-updated.jpg');
  expect(mockExtract).toHaveBeenCalledTimes(2);
});

it('retries rejected extractions', async () => {
  mockExtract.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(palette);
  await expect(getSharedArtworkPalette('file:///a.jpg')).rejects.toThrow('transient');
  await expect(getSharedArtworkPalette('file:///a.jpg')).resolves.toEqual(palette);
  expect(mockExtract).toHaveBeenCalledTimes(2);
});

it('caches a successful null result', async () => {
  mockExtract.mockResolvedValue(null);
  await expect(getSharedArtworkPalette('file:///blank.jpg')).resolves.toBeNull();
  await expect(getSharedArtworkPalette('file:///blank.jpg')).resolves.toBeNull();
  expect(mockExtract).toHaveBeenCalledTimes(1);
});
