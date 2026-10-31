jest.mock('@/hooks/usePhoneLandscapeStatusBar', () => ({ usePhoneLandscapeStatusBar: jest.fn() }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/utils/deviceLayout', () => ({ __esModule: true, IS_TABLET: false }));
jest.mock('@/hooks/usePhoneNpsOrientation', () => ({
  usePhoneNpsOrientation: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: { textPrimary: '#fff', red: '#f00' } }) }));
jest.mock('@/hooks/useIsTabletPortrait', () => ({ useIsTabletPortrait: jest.fn(() => false) }));
jest.mock('@/screens/player/player-tablet-portrait', () => ({ PlayerTabletPortrait: () => null }));
jest.mock('@/screens/player/player-phone-portrait', () => ({ PlayerPhonePortrait: jest.fn(() => null) }));

import { render } from '@testing-library/react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { usePhoneNpsOrientation } from '@/hooks/usePhoneNpsOrientation';
import * as DeviceLayout from '@/utils/deviceLayout';
import { useIsTabletPortrait } from '@/hooks/useIsTabletPortrait';
import { PlayerPhonePortrait } from '@/screens/player/player-phone-portrait';
import { PlayerTabletPortrait } from '@/screens/player/player-tablet-portrait';
import PlayerRoute from '@/app/player';

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.mocked(useIsTabletPortrait).mockReturnValue(false);
  jest.clearAllMocks();
  Object.defineProperty(DeviceLayout, 'IS_TABLET', { configurable: true, value: false });
});
afterEach(() => jest.restoreAllMocks());

it.each([[390, 844, false], [844, 390, true], [900, 430, true], [932, 430, true]])(
  'selects the phone presentation at %s x %s', (width, height, landscape) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    render(<PlayerRoute />);
    expect(jest.mocked(PlayerPhonePortrait).mock.calls.at(-1)?.[0]?.landscape).toBe(landscape);
    expect(require('@/hooks/usePhoneLandscapeStatusBar').usePhoneLandscapeStatusBar).toHaveBeenLastCalledWith(landscape);
  },
);

it('keeps the same phone shell mounted when dimensions change', () => {
  const dimensions = jest.mocked(useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  const screen = render(<PlayerRoute />);
  dimensions.mockReturnValue({ width: 932, height: 430, scale: 1, fontScale: 1 });
  screen.rerender(<PlayerRoute />);
  expect(jest.mocked(PlayerPhonePortrait).mock.calls.at(-1)?.[0]?.landscape).toBe(true);
});

it('retains tablet portrait route selection', () => {
  jest.mocked(useIsTabletPortrait).mockReturnValue(true);
  const screen = render(<PlayerRoute />);
  expect(screen.UNSAFE_getByType(PlayerTabletPortrait)).toBeTruthy();
  expect(PlayerPhonePortrait).not.toHaveBeenCalled();
  expect(require('@/hooks/usePhoneLandscapeStatusBar').usePhoneLandscapeStatusBar).not.toHaveBeenCalled();
});

it('keeps a tablet below the wide threshold on its original fallback without phone orientation handling', () => {
  Object.defineProperty(DeviceLayout, 'IS_TABLET', { configurable: true, value: true });
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 850, height: 600, scale: 1, fontScale: 1 });
  render(<PlayerRoute />);
  expect(jest.mocked(PlayerPhonePortrait).mock.calls.at(-1)?.[0]?.landscape).toBeUndefined();
});

it('requests the retained orientation lifecycle without rendering experiment controls', () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 844, height: 390, scale: 1, fontScale: 1 });
  const screen = render(<PlayerRoute />);
  expect(usePhoneNpsOrientation).toHaveBeenCalled();
  expect(screen.queryByText(/DEV:/)).toBeNull();
  expect(jest.mocked(PlayerPhonePortrait).mock.calls.at(-1)?.[0]).toEqual({ landscape: true });
});
