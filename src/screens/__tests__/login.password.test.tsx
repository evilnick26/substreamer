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
    selector({ isLoggedIn: false, setSession: mockSetSession }),
}));
jest.mock('../../store/onboardingStore', () => ({
  onboardingStore: { getState: () => ({ hasCompleted: true }) },
}));
jest.mock('../../store/persistence', () => ({ isDbHealthy: () => true }));
jest.mock('../../store/serverInfoStore', () => ({
  serverInfoStore: { getState: () => ({ setServerInfo: jest.fn() }) },
}));

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { login } from '../../services/subsonicService';
import { LoginScreen } from '../login';

const mockSetSession = jest.fn();
const mockReplace = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
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

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(login).toHaveBeenCalledWith('https://sancti.fi', 'Nick', password, false);
  expect(mockSetSession).toHaveBeenCalledWith('https://sancti.fi', 'Nick', password, '1.16.1', false);
});
