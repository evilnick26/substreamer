import { Platform, useWindowDimensions } from 'react-native';

import { usePhoneLandscapeStatusBar } from '@/hooks/usePhoneLandscapeStatusBar';
import { usePhoneNpsOrientation } from '@/hooks/usePhoneNpsOrientation';
import { PlayerPhonePortrait } from './player-phone-portrait';

/** Keep the phone screen shell mounted while its player-tab presentation rotates. */
export function PlayerPhone() {
  const { width, height } = useWindowDimensions();
  const landscape = Platform.OS === 'android' && width > height;
  usePhoneLandscapeStatusBar(landscape);
  usePhoneNpsOrientation();
  return <PlayerPhonePortrait landscape={landscape} />;
}
