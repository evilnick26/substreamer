/** Issue #77: temporary diagnostic control. Remove after automatic refill is validated. */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';

import { testRadioInfinite } from '../services/radioInfiniteService';

export function RadioInfiniteTestButton() {
  const [busy, setBusy] = useState(false);
  const onPress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const count = await testRadioInfinite();
      Alert.alert('Radio Infinite', `${count} recommendations added to the queue.`);
    } catch (error) {
      Alert.alert('Radio Infinite test failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Test Radio Infinite"
      disabled={busy} onPress={() => void onPress()} style={{ paddingVertical: 6 }}>
      {busy ? <ActivityIndicator size="small" /> :
        <Text style={{ color: '#ffcc00', fontSize: 11 }}>TEST RI</Text>}
    </Pressable>
  );
}
