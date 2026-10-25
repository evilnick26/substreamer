import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';

import { ClientUpdateController } from '../ClientUpdateController';
import { SanctifiVersionLabel } from '../settings/SanctifiVersionLabel';
import { clientUpdateChecker, createClientUpdateChecker } from '../../services/clientUpdateService';
import { themedAlertStore } from '../../store/themedAlertStore';
import { onboardingStore } from '../../store/onboardingStore';
import { certPromptStore } from '../../store/certPromptStore';
import { backgroundPlaybackPromptStore } from '../../store/backgroundPlaybackPromptStore';

jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: { textSecondary: '#555' } }) }));
jest.mock('expo-application', () => ({ nativeBuildVersion: '80000186' }));
jest.mock('../../store/onboardingStore', () => ({ onboardingStore: require('zustand').create(() => ({ visible: false })) }));
jest.mock('../../store/backgroundPlaybackPromptStore', () => ({ backgroundPlaybackPromptStore: require('zustand').create(() => ({ visible: false })) }));
const manifest = {
  schemaVersion: 1, versionCode: 80000187, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000187.apk', sha256: 'a'.repeat(64),
  releaseNotes: 'Startup test release',
};
const response = (value: unknown = manifest) => ({ ok: true, text: async () => JSON.stringify(value) });
let fetchManifest: jest.Mock;
let listeners: Set<(state: AppStateStatus) => void>;
const initialState = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
function foreground(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true, writable: true });
  act(() => listeners.forEach((listener) => listener(state)));
}
async function settle() { await act(async () => {}); }
async function advance(ms: number) { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); }
function cancelDialog() { act(() => themedAlertStore.getState().hide()); }

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'android');
  listeners = new Set();
  foreground('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } };
  });
  themedAlertStore.getState().hide();
  onboardingStore.setState({ visible: false });
  certPromptStore.setState({ visible: false });
  backgroundPlaybackPromptStore.setState({ visible: false });
  fetchManifest = jest.fn().mockResolvedValue(response());
  const checker = createClientUpdateChecker({ fetchManifest, installedBuild: () => '80000186', isAndroid: () => true, timeoutMs: 100 });
  jest.spyOn(clientUpdateChecker, 'check').mockImplementation(checker.check);
  jest.spyOn(clientUpdateChecker, 'checkAutomatic').mockImplementation(checker.checkAutomatic);
  jest.spyOn(clientUpdateChecker, 'getAutomaticRetryDelay').mockImplementation(checker.getAutomaticRetryDelay);
  jest.spyOn(clientUpdateChecker, 'claimPrompt').mockImplementation(checker.claimPrompt);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(AppState, 'currentState', initialState);
  jest.useRealTimers();
});

test('does not consume automatic checking before hydration/auth/navigation/splash readiness', async () => {
  const { rerender } = render(<ClientUpdateController ready={false} />);
  await settle();
  expect(fetchManifest).not.toHaveBeenCalled();
  expect(clientUpdateChecker.claimPrompt).not.toHaveBeenCalled();
  rerender(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState()).toMatchObject({ visible: true, title: 'sancti.fi update available' });
  expect(themedAlertStore.getState().message).toContain('Version 8.1.8 (build 80000187)');
  expect(themedAlertStore.getState().message).toContain('Startup test release');
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test('background initial mount defers the first attempt until the activity becomes active', async () => {
  foreground('background');
  render(<ClientUpdateController ready />);
  await advance(20000);
  expect(fetchManifest).not.toHaveBeenCalled();
  foreground('active');
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  expect(themedAlertStore.getState().visible).toBe(true);
});

test('a ready foreground transient failure recovers automatically after bounded backoff', async () => {
  fetchManifest.mockRejectedValueOnce(new Error('offline'));
  render(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(false);
  await advance(1999);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetchManifest).toHaveBeenCalledTimes(2);
  expect(themedAlertStore.getState().visible).toBe(true);
});

test('persistent failure stops after three attempts, including across remounts/resumes', async () => {
  fetchManifest.mockRejectedValue(new Error('offline'));
  const first = render(<ClientUpdateController ready />);
  await settle();
  await advance(2000);
  await advance(5000);
  expect(fetchManifest).toHaveBeenCalledTimes(3);
  await advance(60000);
  foreground('background'); foreground('active');
  await settle();
  first.unmount();
  render(<><ClientUpdateController ready /><SanctifiVersionLabel /></>);
  await advance(60000);
  expect(fetchManifest).toHaveBeenCalledTimes(3);
  expect(themedAlertStore.getState().visible).toBe(false);
  fetchManifest.mockResolvedValue(response());
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(4);
  expect(themedAlertStore.getState().visible).toBe(true);
});

test('pending backoff is cancelled while backgrounded; resume continues the same budget', async () => {
  fetchManifest.mockRejectedValueOnce(new Error('offline'));
  render(<ClientUpdateController ready />);
  await settle();
  foreground('background');
  await advance(60000);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  foreground('active');
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(2);
  expect(themedAlertStore.getState().visible).toBe(true);
});

test('unmount cancels scheduled retries and removes AppState listeners', async () => {
  fetchManifest.mockRejectedValueOnce(new Error('offline'));
  const first = render(<ClientUpdateController ready />);
  await settle();
  expect(listeners.size).toBe(1);
  first.unmount();
  expect(listeners.size).toBe(0);
  await advance(60000);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  render(<ClientUpdateController ready />);
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(2);
});

test('a successful in-flight response while backgrounded is retained without claiming a prompt', async () => {
  let finish!: (value: unknown) => void;
  fetchManifest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<ClientUpdateController ready />);
  await settle();
  foreground('background');
  await act(async () => finish(response()));
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(clientUpdateChecker.claimPrompt).not.toHaveBeenCalled();
  foreground('active');
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('readiness lost during a request defers its cached result until readiness returns', async () => {
  let finish!: (value: unknown) => void;
  fetchManifest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { rerender } = render(<ClientUpdateController ready />);
  await settle();
  rerender(<ClientUpdateController ready={false} />);
  await act(async () => finish(response()));
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(clientUpdateChecker.claimPrompt).not.toHaveBeenCalled();
  rerender(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test.each([
  { name: 'onboarding', setVisible: (visible: boolean) => onboardingStore.setState({ visible }) },
  { name: 'certificate', setVisible: (visible: boolean) => certPromptStore.setState({ visible }) },
  { name: 'playback guidance', setVisible: (visible: boolean) => backgroundPlaybackPromptStore.setState({ visible }) },
])('defers presentation behind $name without refetching', async ({ setVisible }) => {
  setVisible(true);
  render(<ClientUpdateController ready />);
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(1);
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(clientUpdateChecker.claimPrompt).not.toHaveBeenCalled();
  act(() => setVisible(false));
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('waits for an existing themed alert instead of overwriting it', async () => {
  themedAlertStore.getState().show('Other alert', 'Keep this', []);
  render(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().title).toBe('Other alert');
  expect(clientUpdateChecker.claimPrompt).not.toHaveBeenCalled();
  cancelDialog();
  await settle();
  expect(themedAlertStore.getState().title).toBe('sancti.fi update available');
});

test('global branded dialog survives controller remount; dismissal prevents duplicates', async () => {
  const first = render(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  first.unmount();
  const second = render(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  cancelDialog();
  await settle();
  foreground('background'); foreground('active');
  await settle();
  second.unmount();
  render(<ClientUpdateController ready />);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('Download remains an explicit action on the automatic dialog', async () => {
  render(<ClientUpdateController ready />);
  await settle();
  expect(Linking.openURL).not.toHaveBeenCalled();
  const download = themedAlertStore.getState().buttons.find((button) => button.text === 'Download APK');
  expect(download).toBeDefined();
  await act(async () => download!.onPress!());
  expect(Linking.openURL).toHaveBeenCalledWith(manifest.apkUrl);
});

test('manual checking stays immediate during automatic backoff and suppresses duplicate automatic prompting', async () => {
  fetchManifest.mockRejectedValueOnce(new Error('offline'));
  render(<><ClientUpdateController ready /><SanctifiVersionLabel /></>);
  await settle();
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  expect(fetchManifest).toHaveBeenCalledTimes(2);
  cancelDialog();
  await advance(2000);
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(fetchManifest).toHaveBeenCalledTimes(3);
});

test.each(['current', 'older', 'invalid'])('automatic %s stays quiet and does not retry', async (scenario) => {
  const code = scenario === 'current' ? 80000186 : 80000185;
  fetchManifest.mockResolvedValue(response(scenario === 'invalid' ? {} : { ...manifest, versionCode: code,
    apkUrl: `https://updates.sancti.fi/client/apks/sanctifi-${code}.apk` }));
  render(<ClientUpdateController ready />);
  await advance(60000);
  expect(themedAlertStore.getState().visible).toBe(false);
  expect(fetchManifest).toHaveBeenCalledTimes(1);
});

test('manual checking can rediscover an update after automatic dismissal', async () => {
  render(<><ClientUpdateController ready /><SanctifiVersionLabel /></>);
  await settle();
  expect(themedAlertStore.getState().visible).toBe(true);
  cancelDialog();
  await settle();
  expect(themedAlertStore.getState().visible).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }));
  await settle();
  expect(fetchManifest).toHaveBeenCalledTimes(2);
  expect(themedAlertStore.getState().visible).toBe(true);
});
