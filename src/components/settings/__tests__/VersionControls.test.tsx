import React from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SanctifiVersionLabel } from '../SanctifiVersionLabel';
import { VersionFooter } from '../VersionFooter';
import { clientUpdateChecker, type UpdateResult } from '../../../services/clientUpdateService';
import { devOptionsStore } from '../../../store/devOptionsStore';
import { themedAlertStore } from '../../../store/themedAlertStore';
import { notificationAsync, selectionAsync } from '../../../utils/haptics';
import { processingOverlayStore } from '../../../store/processingOverlayStore';

jest.mock('../../../hooks/useTheme', () => ({ useTheme: () => ({ colors: { textSecondary: '#888' } }) }));
jest.mock('../../../services/clientUpdateService', () => ({
  clientUpdateChecker: { check: jest.fn(), claimPrompt: jest.fn() },
}));
jest.mock('../../../utils/haptics', () => ({ selectionAsync: jest.fn(), notificationAsync: jest.fn() }));
jest.mock('../../../store/processingOverlayStore', () => ({ processingOverlayStore: { getState: () => ({ showSuccess: mockShowSuccess }) } }));
const mockShowSuccess = jest.fn();
const manifest = {
  schemaVersion: 1 as const, versionCode: 80000187, versionName: '0.2.0',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000187.apk',
  sha256: 'a'.repeat(64), releaseNotes: '<b>Plain text release notes</b>',
};
const available: UpdateResult = { status: 'available', installedVersionCode: 80000186, manifest };

// Native alert on iOS, themed root-hosted alert on Android: exercise the public hook on both.
function latestButtons() {
  return Platform.OS === 'android' ? themedAlertStore.getState().buttons
    : jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
}
function latestMessage() {
  return Platform.OS === 'android' ? themedAlertStore.getState().message
    : jest.mocked(Alert.alert).mock.calls.at(-1)?.[1];
}

beforeEach(() => {
  jest.clearAllMocks();
  devOptionsStore.setState({ enabled: false });
  themedAlertStore.getState().hide();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.mocked(clientUpdateChecker.check).mockResolvedValue({ ...available, status: 'current' });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('only the sancti.fi version line checks; attribution remains plain text', async () => {
  render(<View><SanctifiVersionLabel /><VersionFooter /></View>);
  const attribution = screen.getByText('Based on Substreamer');
  expect(attribution.type).toBe('Text');
  expect(attribution.parent?.props.onPress).toBeUndefined();
  fireEvent.press(attribution);
  expect(clientUpdateChecker.check).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Up to date (installed build 80000186).');
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(1);
  expect(devOptionsStore.getState().enabled).toBe(false);
});

test('checking state is accessible, repeated taps share the action, and subsequent checks work', async () => {
  let finish!: (result: UpdateResult) => void;
  jest.mocked(clientUpdateChecker.check).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<SanctifiVersionLabel />);
  const button = screen.getByRole('button', { name: 'Check for updates' });
  fireEvent.press(button);
  expect(screen.getByText('Checking for updates…')).toBeTruthy();
  expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
  fireEvent.press(button);
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(1);
  await act(async () => finish({ ...available, status: 'current' }));
  fireEvent.press(button);
  await waitFor(() => expect(clientUpdateChecker.check).toHaveBeenCalledTimes(2));
});

test.each([
  ['network', 'Unable to reach the Alpha release.'], ['timeout', 'The update check timed out.'],
  ['manifest', 'The Alpha release information is invalid.'], ['build', 'Unable to read the installed Android build number.'],
  ['unsupported', 'Update checks are available on Android only.'],
] as const)('manual %s failure has visible feedback', async (reason, text) => {
  jest.mocked(clientUpdateChecker.check).mockResolvedValue({ status: 'error', reason });
  render(<SanctifiVersionLabel />);
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  expect(await screen.findByText(new RegExp(text.replaceAll('.', '\\.')))).toBeTruthy();
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test('older channel release never offers a downgrade', async () => {
  jest.mocked(clientUpdateChecker.check).mockResolvedValue({ ...available, status: 'older' });
  render(<SanctifiVersionLabel />);
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Installed build 80000186 is newer than the Alpha release. No downgrade offered.');
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test('newer release shows version/build and plain notes; browser opens only on explicit Download', async () => {
  jest.mocked(clientUpdateChecker.check).mockResolvedValue(available);
  render(<SanctifiVersionLabel />);
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Version 0.2.0 (build 80000187)');
  expect(latestMessage()).toContain('<b>Plain text release notes</b>');
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(clientUpdateChecker.claimPrompt).toHaveBeenCalledWith(80000187);
  const download = latestButtons().find((button) => button.text === 'Download APK');
  await act(async () => download?.onPress?.());
  expect(Linking.openURL).toHaveBeenCalledWith(manifest.apkUrl);
});

test('browser failure is reported', async () => {
  jest.mocked(clientUpdateChecker.check).mockResolvedValue(available);
  jest.mocked(Linking.openURL).mockRejectedValue(new Error('no browser'));
  render(<SanctifiVersionLabel />);
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Version 0.2.0 (build 80000187)');
  await act(async () => latestButtons().find((button) => button.text === 'Download APK')?.onPress?.());
  expect(latestMessage()).toContain('Unable to open the APK link');
});

test('inherited footer retains five-tap unlock, countdown and haptics without checking for updates', () => {
  jest.useFakeTimers();
  render(<View><SanctifiVersionLabel /><VersionFooter /></View>);
  const inherited = screen.UNSAFE_getByType(VersionFooter);
  const press = () => fireEvent.press(inherited.findByType(Text));
  press(); press();
  expect(selectionAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByText('3 more taps for developer options')).toBeTruthy();
  expect(devOptionsStore.getState().enabled).toBe(false);
  press(); press();
  expect(devOptionsStore.getState().enabled).toBe(false);
  press();
  expect(devOptionsStore.getState().enabled).toBe(true);
  expect(notificationAsync).toHaveBeenCalledTimes(1);
  expect(processingOverlayStore.getState().showSuccess).toHaveBeenCalledTimes(1);
  expect(clientUpdateChecker.check).not.toHaveBeenCalled();
  press();
  expect(notificationAsync).toHaveBeenCalledTimes(1);
});

test('the inherited three-second tap window still expires', () => {
  jest.useFakeTimers();
  render(<VersionFooter />);
  const press = () => fireEvent.press(screen.UNSAFE_getByType(Text));
  press(); press(); press(); press();
  act(() => { jest.advanceTimersByTime(3001); });
  press();
  expect(devOptionsStore.getState().enabled).toBe(false);
  expect(clientUpdateChecker.check).not.toHaveBeenCalled();
});
