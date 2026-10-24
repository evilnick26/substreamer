import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ClientUpdateBanner } from '../ClientUpdateBanner';
import { clientUpdateChecker, createClientUpdateChecker } from '../../services/clientUpdateService';

jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: { card: '#fff', border: '#ddd', primary: '#00f', textPrimary: '#000', textSecondary: '#555' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24 }) }));
jest.mock('expo-application', () => ({ nativeBuildVersion: '80000186' }));
jest.mock('../../hooks/useClientUpdateFeedback', () => ({ useClientUpdateFeedback: () => mockShowUpdate }));
const mockShowUpdate = jest.fn();
const manifest = {
  schemaVersion: 1, versionCode: 80000187, versionName: '0.2.0',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000187.apk', sha256: 'a'.repeat(64),
};
let fetchManifest: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  fetchManifest = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(manifest) });
  const checker = createClientUpdateChecker({ fetchManifest, installedBuild: () => '80000186', isAndroid: () => true, timeoutMs: 100 });
  jest.spyOn(clientUpdateChecker, 'checkAutomatic').mockImplementation(checker.checkAutomatic);
  jest.spyOn(clientUpdateChecker, 'claimPrompt').mockImplementation(checker.claimPrompt);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

async function settle() { await act(async () => {}); }

test('startup is nonblocking; dismiss then remount neither rechecks nor prompts again', async () => {
  const first = render(<ClientUpdateBanner />);
  expect(screen.queryByText('View update')).toBeNull();
  await settle();
  expect(screen.getByText(/Version 0.2.0 \(build 80000187\)/)).toBeTruthy();
  expect(Linking.openURL).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText('View update')).toBeNull();
  first.unmount();
  render(<ClientUpdateBanner />);
  await settle();
  expect(screen.queryByText('View update')).toBeNull();
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('pending request survives unmount and can notify the next mounted instance', async () => {
  let finish!: (value: unknown) => void;
  fetchManifest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = render(<ClientUpdateBanner />);
  await settle();
  first.unmount();
  render(<ClientUpdateBanner />);
  await act(async () => finish({ ok: true, text: async () => JSON.stringify(manifest) }));
  expect(screen.getByText('View update')).toBeTruthy();
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('details require an explicit press; they do not open the browser automatically', async () => {
  render(<ClientUpdateBanner />);
  await settle();
  expect(mockShowUpdate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'View update' }));
  expect(mockShowUpdate).toHaveBeenCalledWith(manifest);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(screen.queryByText('View update')).toBeNull();
});

test.each(['offline', 'invalid', 'current', 'older'])('automatic %s result stays silent on mount and remount', async (scenario) => {
  if (scenario === 'offline') fetchManifest.mockRejectedValueOnce(new Error('offline'));
  else fetchManifest.mockResolvedValueOnce({ ok: true, text: async () => scenario === 'invalid' ? '{' : JSON.stringify({
    ...manifest, versionCode: scenario === 'current' ? 80000186 : 80000185,
    apkUrl: `https://updates.sancti.fi/client/apks/sanctifi-${scenario === 'current' ? 80000186 : 80000185}.apk`,
  }) });
  const first = render(<ClientUpdateBanner />);
  await settle();
  first.unmount();
  render(<ClientUpdateBanner />);
  await settle();
  expect(screen.queryByText('View update')).toBeNull();
  expect(mockShowUpdate).not.toHaveBeenCalled();
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});
