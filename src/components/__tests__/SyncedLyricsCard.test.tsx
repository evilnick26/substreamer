jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ colors: { textPrimary: '#fff', card: '#111', border: '#333', primary: '#f60' } }) }));

import { Switch } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SyncedLyricsCard } from '../settings/SyncedLyricsCard';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';

test('Appearance switch controls the persistent NPS preference', () => {
  act(() => layoutPreferencesStore.setState({ displaySyncedLyricsInNps: true }));
  const view = render(<SyncedLyricsCard />);
  const toggle = view.UNSAFE_getByType(Switch);
  expect(toggle.props.value).toBe(true);
  fireEvent(toggle, 'valueChange', false);
  expect(layoutPreferencesStore.getState().displaySyncedLyricsInNps).toBe(false);
  expect(view.UNSAFE_getByType(Switch).props.value).toBe(false);
});
