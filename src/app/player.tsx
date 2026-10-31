import { useIsTabletPortrait } from '@/hooks/useIsTabletPortrait';
import { IS_TABLET } from '@/utils/deviceLayout';
import { PlayerPhonePortrait } from '@/screens/player/player-phone-portrait';
import { PlayerPhone } from '@/screens/player/player-phone';
import { PlayerTabletPortrait } from '@/screens/player/player-tablet-portrait';

export default function PlayerRoute() {
  const tabletPortrait = useIsTabletPortrait();
  if (tabletPortrait) return <PlayerTabletPortrait />;
  if (IS_TABLET) return <PlayerPhonePortrait />;
  return <PlayerPhone />;
}
