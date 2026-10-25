jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Redirect: () => null,
}));

jest.mock('../../components/CertificatePromptModal', () => ({ CertificatePromptModal: () => null }));
jest.mock('../../components/LanguageSelector', () => ({ LanguageSelector: () => null }));
jest.mock('../../services/subsonicService', () => ({
  login: jest.fn(),
  fetchServerInfo: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/sslTrustService', () => ({ trustCertificateForHost: jest.fn() }));
jest.mock('../../../modules/expo-ssl-trust/src', () => ({
  getCertificateInfo: jest.fn(),
  isSSLError: jest.fn().mockReturnValue(false),
}));
jest.mock('../../store/authStore', () => ({
  authStore: (selector: (state: { isLoggedIn: boolean; setSession: typeof mockSetSession }) => unknown) =>
    selector({ isLoggedIn: mockLoggedIn, setSession: mockSetSession }),
}));
jest.mock('../../store/onboardingStore', () => ({
  onboardingStore: { getState: () => ({ hasCompleted: true }) },
}));
jest.mock('../../store/persistence', () => ({ isDbHealthy: () => true }));
jest.mock('../../store/serverInfoStore', () => ({
  serverInfoStore: { getState: () => ({ setServerInfo: jest.fn() }) },
}));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { Redirect } from 'expo-router';
import { CertificatePromptModal } from '../../components/CertificatePromptModal';
import { getCertificateInfo, isSSLError } from '../../../modules/expo-ssl-trust/src';
import { trustCertificateForHost } from '../../services/sslTrustService';
import { login } from '../../services/subsonicService';
import { LoginScreen } from '../login';

let mockLoggedIn = false;
const mockSetSession = jest.fn();
const mockReplace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockLoggedIn = false;
  jest.mocked(isSSLError).mockReturnValue(false);
  jest.mocked(login).mockResolvedValue({ success: true, version: '1.16.1' });
});

it('disables password auto-capitalisation while retaining secure entry', () => {
  const { getByPlaceholderText } = render(<LoginScreen />);
  const password = getByPlaceholderText('Password');

  expect(password.props.autoCapitalize).toBe('none');
  expect(password.props.secureTextEntry).toBe(true);
});

it('submits and stores the password with its exact case and whitespace', async () => {
  const { getByPlaceholderText } = render(<LoginScreen />);
  const password = ' aBcD-26! ';
  fireEvent.changeText(getByPlaceholderText('Username'), 'Nick');
  fireEvent.changeText(getByPlaceholderText('Password'), password);
  expect(getByPlaceholderText('Password').props.value).toBe(password);
  fireEvent(getByPlaceholderText('Password'), 'submitEditing');

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library'));
  expect(login).toHaveBeenCalledWith('https://sancti.fi', 'Nick', password, false);
  expect(mockSetSession).toHaveBeenCalledWith('https://sancti.fi', 'Nick', password, '1.16.1', false);
});

it('an already authenticated login screen redirects explicitly to Library', () => {
  mockLoggedIn = true;
  const { UNSAFE_getByType } = render(<LoginScreen />);
  expect(UNSAFE_getByType(Redirect).props.href).toBe('/(tabs)/library');
});

it('successful certificate-trust retry also returns to Library with unchanged credentials', async () => {
  const certificate = {
    subject: 'fixture', issuer: 'fixture', serialNumber: '1',
    sha256Fingerprint: 'a'.repeat(64), validFrom: '2026-01-01', validTo: '2027-01-01',
    isSelfSigned: true, isSystemTrusted: false,
  };
  jest.mocked(login).mockResolvedValueOnce({ success: false, error: 'SSL certificate error' });
  jest.mocked(isSSLError).mockReturnValue(true);
  jest.mocked(getCertificateInfo).mockResolvedValue(certificate);
  const { getByPlaceholderText, UNSAFE_getByType } = render(<LoginScreen />);
  fireEvent.changeText(getByPlaceholderText('Username'), 'Nick');
  fireEvent.changeText(getByPlaceholderText('Password'), ' aBcD-26! ');
  fireEvent(getByPlaceholderText('Password'), 'submitEditing');
  await waitFor(() => expect(UNSAFE_getByType(CertificatePromptModal).props.visible).toBe(true));
  await act(async () => UNSAFE_getByType(CertificatePromptModal).props.onTrust());
  expect(trustCertificateForHost).toHaveBeenCalledWith('sancti.fi', certificate.sha256Fingerprint, certificate.validTo);
  expect(login).toHaveBeenLastCalledWith('https://sancti.fi', 'Nick', ' aBcD-26! ', false);
  expect(mockSetSession).toHaveBeenCalledWith('https://sancti.fi', 'Nick', ' aBcD-26! ', '1.16.1', false);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library');
});
