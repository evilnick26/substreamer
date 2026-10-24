import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemedAlert } from './useThemedAlert';
import { clientUpdateChecker } from '../services/clientUpdateService';
import type { ReleaseManifest } from '../utils/releaseManifest';

export function useClientUpdateFeedback() {
  const { t } = useTranslation();
  const { alert } = useThemedAlert();

  return useCallback((manifest: ReleaseManifest) => {
    clientUpdateChecker.claimPrompt(manifest.versionCode);
    const releaseNotes = manifest.releaseNotes ?? '';
    const notes = releaseNotes.slice(0, 300);
    const message = t('clientUpdateRelease', { version: manifest.versionName, build: manifest.versionCode }) +
      (notes ? `\n\n${notes}${releaseNotes.length > 300 ? '…' : ''}` : '');
    alert(t('clientUpdateAvailable'), message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clientUpdateDownload'),
        onPress: () => {
          // Only manifests accepted by the service reach this explicit action.
          void Linking.openURL(manifest.apkUrl).catch(() => {
            alert(t('clientUpdateFailed'), t('clientUpdateBrowserFailed'));
          });
        },
      },
    ]);
  }, [alert, t]);
}
