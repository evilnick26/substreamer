import React from 'react';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { SettingsScreen } from '../settings';
import { SanctifiVersionLabel } from '../../components/settings/SanctifiVersionLabel';
import { VersionFooter } from '../../components/settings/VersionFooter';
import { clientUpdateChecker } from '../../services/clientUpdateService';
import { devOptionsStore } from '../../store/devOptionsStore';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {
  version: '8.1.8', android: { versionCode: 80000187 }, ios: { buildNumber: '185' },
  extra: { sanctifiVersion: '0.1.0' },
} } }));
jest.mock('expo-application', () => ({ nativeBuildVersion: '80000187' }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: {
  primary: '#07f', textPrimary: '#111', textSecondary: '#888', card: '#fff',
} }) }));
jest.mock('../../store/searchStore', () => ({ searchStore: (select: (s: { headerHeight: number }) => unknown) => select({ headerHeight: 0 }) }));
jest.mock('../../store/onboardingStore', () => ({ onboardingStore: { getState: () => ({ reset: mockResetOnboarding, show: mockShowOnboarding }) } }));
jest.mock('../../services/clientUpdateService', () => ({ clientUpdateChecker: { check: jest.fn(), claimPrompt: jest.fn() } }));
jest.mock('../../utils/haptics', () => ({ notificationAsync: jest.fn(), selectionAsync: jest.fn() }));
jest.mock('../../store/processingOverlayStore', () => ({ processingOverlayStore: { getState: () => ({ showSuccess: jest.fn() }) } }));
const mockPush = jest.fn();
const mockResetOnboarding = jest.fn();
const mockShowOnboarding = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  devOptionsStore.setState({ enabled: false });
  jest.mocked(clientUpdateChecker.check).mockResolvedValue({ status: 'current', installedVersionCode: 80000187, manifest: {
    schemaVersion: 1, versionCode: 80000187, versionName: '8.1.8',
    apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000187.apk', sha256: 'a'.repeat(64),
  } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
async function settle() { await act(async () => {}); }

test('shows the configured semantic identity and full native build separately from the inherited footer', () => {
  render(<SettingsScreen />);
  expect(screen.getByText('sancti.fi Client')).toBeTruthy();
  expect(screen.getByText('Version 0.1.0')).toBeTruthy();
  expect(screen.getByText('Build 80000187')).toBeTruthy();
  expect(screen.getByText('Based on Substreamer')).toBeTruthy();
  expect(screen.UNSAFE_getByType(VersionFooter).findByType(Text).props.children).toMatch(/Version 8\.1\.8/);
});

test('reads the resolved semantic config and installed build rather than independent display literals', () => {
  jest.replaceProperty(Constants.expoConfig!.extra!, 'sanctifiVersion', '2.3.4');
  jest.replaceProperty(Application, 'nativeBuildVersion', '80000999');
  render(<SettingsScreen />);
  expect(screen.getByText('Version 2.3.4')).toBeTruthy();
  expect(screen.getByText('Build 80000999')).toBeTruthy();
  expect(screen.queryByText('Version 0.1.0')).toBeNull();
  expect(screen.UNSAFE_getByType(VersionFooter).findByType(Text).props.children).toMatch(/Version 8\.1\.8/);
});

test('unavailable values are shown as unknown rather than guessed from native versionName or Expo build config', () => {
  jest.replaceProperty(Constants.expoConfig!.extra!, 'sanctifiVersion', undefined);
  jest.replaceProperty(Application, 'nativeBuildVersion', null);
  render(<SettingsScreen />);
  expect(screen.getByText('Version Unknown')).toBeTruthy();
  expect(screen.getByText('Build Unknown')).toBeTruthy();
});

test.each(['sancti.fi Client', 'Version 0.1.0', 'Build 80000187', 'Tap to check for updates'])('tapping %s starts only the manual update check', async (text) => {
  render(<SettingsScreen />);
  fireEvent.press(screen.getByText(text));
  await settle();
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(1);
  expect(devOptionsStore.getState().enabled).toBe(false);
});

test('the whole padded block is accessible, readable and scalable', async () => {
  render(<SettingsScreen />);
  const button = screen.getByRole('button', { name: 'Check for updates' });
  expect(button.props.accessibilityHint).toBe('Checks for a newer sancti.fi Client release.');
  expect(button.props.accessibilityValue.text).toBe('Version 0.1.0, Build 80000187');
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44, paddingVertical: 12, paddingHorizontal: 12, alignSelf: 'stretch' });
  const title = screen.getByText('sancti.fi Client');
  const version = screen.getByText('Version 0.1.0');
  expect(StyleSheet.flatten(title.props.style).fontSize).toBe(16);
  expect(StyleSheet.flatten(version.props.style).fontSize).toBe(14);
  expect(title.props.allowFontScaling).not.toBe(false);
  expect(version.props.allowFontScaling).not.toBe(false);
  fireEvent.press(button);
  await settle();
  fireEvent.press(screen.getByText('Up to date (installed build 80000187).'));
  await settle();
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(2);
});

test('attribution and inherited gesture stay outside the update block with compact spacing', () => {
  render(<SettingsScreen />);
  const attribution = screen.getByText('Based on Substreamer');
  expect(attribution.type).toBe('Text');
  fireEvent.press(attribution);
  expect(clientUpdateChecker.check).not.toHaveBeenCalled();
  const group = screen.UNSAFE_getByType(SanctifiVersionLabel).parent!;
  expect(StyleSheet.flatten(group.props.style).gap).toBe(4);
  const inherited = screen.UNSAFE_getByType(VersionFooter).findByType(Text);
  expect(StyleSheet.flatten(inherited.props.style).marginTop ?? 0).toBe(0);
});

test('five taps on the sancti.fi block never unlock Developer Options; inherited five taps still do', async () => {
  render(<SettingsScreen />);
  for (let i = 0; i < 5; i++) {
    fireEvent.press(screen.getByText('Build 80000187'));
    await settle();
  }
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(5);
  expect(devOptionsStore.getState().enabled).toBe(false);
  const footer = screen.UNSAFE_getByType(VersionFooter);
  for (let i = 0; i < 5; i++) fireEvent.press(footer.findByType(Text));
  expect(devOptionsStore.getState().enabled).toBe(true);
  expect(screen.getByText('File Explorer')).toBeTruthy();
  expect(clientUpdateChecker.check).toHaveBeenCalledTimes(5);
});

test('existing Settings links and welcome-guide controls remain functional', () => {
  render(<SettingsScreen />);
  fireEvent.press(screen.getByText('Server & Account'));
  expect(mockPush).toHaveBeenCalledWith('/settings-server');
  fireEvent.press(screen.getByText('Help & Welcome Guide'));
  expect(mockResetOnboarding).toHaveBeenCalledTimes(1);
  expect(mockShowOnboarding).toHaveBeenCalledTimes(1);
  expect(clientUpdateChecker.check).not.toHaveBeenCalled();
});
