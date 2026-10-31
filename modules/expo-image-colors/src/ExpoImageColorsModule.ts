import { requireNativeModule } from 'expo-modules-core';

export interface PaletteMode {
  /** Dominant hue bucket's colour, lightness-clamped for this theme. `#RRGGBB`. */
  primary: string;
  /** A distinct secondary hue bucket's colour (max-count ≥60° away), else `null`. */
  secondary: string | null;
}

export interface Palette {
  /** Image-wide neutrality, independent of the dominant hue and palette availability. */
  monochrome?: boolean;
  /** Suitable for dark-mode backgrounds — always dark enough for white icons. */
  dark: PaletteMode | null;
  /** Suitable for light-mode backgrounds — always light enough for black icons. */
  light: PaletteMode | null;
}

interface ExpoImageColorsNativeModule {
  /**
   * Extract the palette from a local image.
   * Returns `null` for decode failure, fully transparent images, or no usable
   * colour without monochrome evidence. Monochrome images may have null modes.
   */
  getImagePaletteAsync(uri: string): Promise<Palette | null>;
}

let module: ExpoImageColorsNativeModule;

try {
  module = requireNativeModule('ExpoImageColors');
} catch {
  console.warn(
    '[expo-image-colors] Native module not found. ' +
      'Run `npx expo run:ios` or `npx expo run:android` to rebuild with the native module.',
  );

  module = {
    getImagePaletteAsync: () => Promise.resolve(null),
  } as unknown as ExpoImageColorsNativeModule;
}

export default module;
