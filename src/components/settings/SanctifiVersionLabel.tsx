import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { SANCTIFI_VERSION } from '../../config/sanctifiVersion';

/** Additive sancti.fi identity above Substreamer's untouched version footer. */
export function SanctifiVersionLabel() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        {`sancti.fi client Version ${SANCTIFI_VERSION}`}
      </Text>
      <Text style={[styles.basedOn, { color: colors.textSecondary }]}>Based on Substreamer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
  basedOn: {
    fontSize: 12,
    textAlign: 'center',
  },
});
