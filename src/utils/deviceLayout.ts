import { Dimensions } from 'react-native';

/** Device identity stays independent of the current window orientation. */
export function isTabletScreen(width: number, height: number): boolean {
  return Math.min(width, height) >= 600;
}

function readIsTablet(): boolean {
  try {
    const { width, height } = Dimensions.get('screen');
    return isTabletScreen(width, height);
  } catch {
    return false;
  }
}

export const IS_TABLET = readIsTablet();
