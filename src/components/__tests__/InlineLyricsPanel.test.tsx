import { act, render } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text } from 'react-native';

import { InlineLyricsPanel } from '../InlineLyricsPanel';
import type { ThemeColors } from '../../constants/theme';
import type { Child, LyricsData } from '../../services/subsonicService';
import { appStateStore } from '../../store/appStateStore';
import { playerStore } from '../../store/playerStore';

const colors = { textPrimary: '#fff', textSecondary: '#aaa' } as ThemeColors;
const lyrics: LyricsData = { synced: true, source: 'structured', offsetMs: 0, lines: [
  { startMs: 1000, text: 'Previous' },
  { startMs: 2000, text: 'One line' },
  { startMs: 3000, text: 'And I hope the junkyard a few blocks from\nhere' },
  { startMs: 4000, text: '' },
  { startMs: 5000, text: 'Next' },
] };

const originalWindow = Dimensions.get('window');
afterEach(() => { act(() => Dimensions.set({ window: originalWindow })); });

beforeEach(() => {
  Dimensions.set({ window: { ...originalWindow, fontScale: 1 } });
  appStateStore.setState({ isActive: true });
  playerStore.setState({ currentTrack: { id: 'a' } as Child, position: 2 });
});

test('one- and two-line current entries use natural text height inside the same centred reservation', () => {
  const view = render(<InlineLyricsPanel trackId="a" lyrics={lyrics} colors={colors} />);
  const panelStyle = StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style);
  expect(panelStyle).toMatchObject({ minHeight: 96, justifyContent: 'center', gap: 2, paddingVertical: 4 });
  const currentStyle = StyleSheet.flatten(view.getByTestId('inline-lyrics-current').props.style);
  expect(currentStyle).toMatchObject({ fontWeight: '700', lineHeight: 22 });
  expect(currentStyle.minHeight).toBeUndefined();
  expect(view.getByTestId('inline-lyrics-current').props.numberOfLines).toBe(2);
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('One line');
  act(() => playerStore.setState({ position: 3 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe(lyrics.lines[2].text);
  expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style)).toEqual(panelStyle);
  for (const name of ['previous', 'next']) {
    expect(view.getByTestId(`inline-lyrics-${name}`).props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(view.getByTestId(`inline-lyrics-${name}`).props.style).color).toBe(colors.textSecondary);
  }
});

test('before the first timestamp only the upcoming entry occupies the centred panel', () => {
  playerStore.setState({ position: 0 });
  const view = render(<InlineLyricsPanel trackId="a" lyrics={lyrics} colors={colors} />);
  expect(view.queryByTestId('inline-lyrics-previous')).toBeNull();
  expect(view.queryByTestId('inline-lyrics-current')).toBeNull();
  expect(view.UNSAFE_getAllByType(Text)).toHaveLength(1);
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('Previous');
  expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style).minHeight).toBe(96);
});

test('an explicit blank current entry retains its place without substituting text', () => {
  playerStore.setState({ position: 4 });
  const view = render(<InlineLyricsPanel trackId="a" lyrics={lyrics} colors={colors} />);
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('');
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('Next');
  expect(view.UNSAFE_getAllByType(Text)).toHaveLength(3);
});


test('the reserved line-height budget scales with accessibility fonts and stays stable across entries', () => {
  const window = Dimensions.get('window');
  try {
    Dimensions.set({ window: { ...window, fontScale: 2 } });
    const view = render(<InlineLyricsPanel trackId="a" lyrics={lyrics} colors={colors} />);
    expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style).minHeight).toBe(180);
    act(() => playerStore.setState({ position: 3 }));
    expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style).minHeight).toBe(180);
    act(() => playerStore.setState({ position: 0 }));
    expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style).minHeight).toBe(180);
  } finally {
    act(() => Dimensions.set({ window }));
  }
});
