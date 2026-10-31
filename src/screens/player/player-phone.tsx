import { Alert, Platform, Pressable, Text, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePhoneNpsOrientation } from '@/hooks/usePhoneNpsOrientation';
import { useTheme } from '@/hooks/useTheme';
import { PlayerPhonePortrait } from './player-phone-portrait';

/** Keep the phone screen shell mounted while its player-tab presentation rotates. */
export function PlayerPhone() {
  const { width, height } = useWindowDimensions();
  const { mode, manualLandscape, toggleManualLandscape, retryOrientation, returnToPortrait, error } = usePhoneNpsOrientation();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const label = error ? 'npsOrientationFailed' : mode === 'automatic'
    ? 'npsAutomaticBadge' : manualLandscape ? 'npsReturnPortrait' : 'npsEnterLandscape';
  const control = Platform.OS === 'android' ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={() => {
        if (error) {
          Alert.alert(t('npsExperimentTitle'), t('npsOrientationFailedHint'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('retry'), onPress: retryOrientation },
            ...(mode === 'manual' ? [{ text: t('npsReturnPortrait'), onPress: returnToPortrait }] : []),
          ]);
        } else if (mode === 'automatic') {
          Alert.alert(t('npsExperimentTitle'), t('npsAutomaticHint'));
        } else toggleManualLandscape();
      }}
      style={{ padding: 8 }}
    >
      <Text style={{ color: error ? colors.red : colors.textPrimary, fontSize: 12 }}>{t(label)}</Text>
    </Pressable>
  ) : undefined;

  return <PlayerPhonePortrait landscape={Platform.OS === 'android' && width > height} orientationControl={control} />;
}
