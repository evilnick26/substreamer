jest.mock('@/store/persistence/kvStorage', () => require('@/store/persistence/__mocks__/kvStorage'));
jest.mock('@/utils/deviceLayout', () => ({ __esModule: true, IS_TABLET: false }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ colors: { primary: '#f60', textPrimary: '#fff', textSecondary: '#888', card: '#111' } }) }));

import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { npsExperimentStore } from '@/store/npsExperimentStore';
import * as DeviceLayout from '@/utils/deviceLayout';
import { NpsExperimentCard } from '../NpsExperimentCard';

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(DeviceLayout, 'IS_TABLET', { configurable: true, value: false });
  npsExperimentStore.setState({ mode: 'manual' });
});

it('selects both persisted experiments in the tester setting', () => {
  const screen = render(<NpsExperimentCard />);
  expect(screen.getByText('Development: phone NPS rotation')).toBeTruthy();
  fireEvent.press(screen.getByText('Automatic rotation'));
  expect(npsExperimentStore.getState().mode).toBe('automatic');
  expect(screen.getAllByRole('radio')[0].props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByText('Manual landscape'));
  expect(npsExperimentStore.getState().mode).toBe('manual');
});

it('does not expose the experiment on tablets or iOS', () => {
  Object.defineProperty(DeviceLayout, 'IS_TABLET', { configurable: true, value: true });
  const screen = render(<NpsExperimentCard />);
  expect(screen.toJSON()).toBeNull();
  Object.defineProperty(DeviceLayout, 'IS_TABLET', { configurable: true, value: false });
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  screen.rerender(<NpsExperimentCard />);
  expect(screen.toJSON()).toBeNull();
});
