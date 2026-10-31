import { useWindowDimensions } from 'react-native';

import { IS_TABLET } from '@/utils/deviceLayout';

type LayoutMode = 'compact' | 'wide';

/** Tablet wide mode requires a landscape window at least 900dp wide. */
export function getLayoutMode(width: number, height: number, isTablet = true): LayoutMode {
  return isTablet && width >= 900 && width > height ? 'wide' : 'compact';
}

/** Hook that returns the current layout mode based on window dimensions. */
export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions();
  return getLayoutMode(width, height, IS_TABLET);
}
