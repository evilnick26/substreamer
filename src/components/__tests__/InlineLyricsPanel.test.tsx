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

test('a long introduction stays empty until exactly three seconds before the first effective timestamp', () => {
  const intro: LyricsData = { ...lyrics, lines: [
    { startMs: 45000, text: 'First, Original!' },
    { startMs: 90000, text: 'Second' },
    { startMs: 120000, text: 'Last' },
  ] };
  playerStore.setState({ position: 0 });
  const view = render(<InlineLyricsPanel trackId="a" lyrics={intro} colors={colors} />);
  const panel = view.getByTestId('inline-lyrics');
  const style = StyleSheet.flatten(panel.props.style);
  for (const position of [0, 41.999]) {
    act(() => playerStore.setState({ position }));
    expect(view.queryByText('First, Original!')).toBeNull();
    expect(view.queryAllByText(/.+/)).toHaveLength(0);
    expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style)).toEqual(style);
  }
  act(() => playerStore.setState({ position: 42 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('First, Original!');
  expect(view.queryByTestId('inline-lyrics-current')).toBeNull();
  act(() => playerStore.setState({ position: 45 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('First, Original!');
  expect(StyleSheet.flatten(view.getByTestId('inline-lyrics-current').props.style).fontWeight).toBe('700');
  // Long instrumental gap: clear all lines after 3s.
  for (const position of [48, 80, 86.999]) {
    act(() => playerStore.setState({ position }));
    expect(view.queryAllByText(/.+/)).toHaveLength(0);
  }

  // Anticipate the next lyric exactly 3s before its timestamp.
  act(() => playerStore.setState({ position: 87 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('Second');
  expect(view.queryByTestId('inline-lyrics-current')).toBeNull();

  act(() => playerStore.setState({ position: 90 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('Second');

  // Final lyric clears after five seconds.
  act(() => playerStore.setState({ position: 120 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('Last');
  act(() => playerStore.setState({ position: 125 }));
  expect(view.queryAllByText(/.+/)).toHaveLength(0);
  act(() => playerStore.setState({ position: 41.999 }));
  expect(view.queryAllByText(/.+/)).toHaveLength(0);
  expect(view.getByTestId('inline-lyrics')).toBe(panel);
  expect(StyleSheet.flatten(view.getByTestId('inline-lyrics').props.style)).toEqual(style);
});

test.each([2000, 3000, 0])('first timestamp %ims is already visible at playback zero', (startMs) => {
  playerStore.setState({ position: 0 });
  const view = render(<InlineLyricsPanel trackId="a" lyrics={{ ...lyrics,
    lines: [{ startMs, text: 'First' }],
  }} colors={colors} />);
  expect(view.getByTestId(startMs === 0 ? 'inline-lyrics-current' : 'inline-lyrics-next').props.accessibilityLabel).toBe('First');
});

test.each([500, -500, 0.5])('anticipation uses the existing effective timestamp with offset %ims without rounding', (offsetMs) => {
  playerStore.setState({ position: (42000 + offsetMs - 1) / 1000 });
  const view = render(<InlineLyricsPanel trackId="a" lyrics={{ ...lyrics, offsetMs,
    lines: [{ startMs: 45000, text: 'Offset first' }],
  }} colors={colors} />);
  expect(view.queryByText('Offset first')).toBeNull();
  act(() => playerStore.setState({ position: (42000 + offsetMs) / 1000 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('Offset first');
  act(() => playerStore.setState({ position: (45000 + offsetMs) / 1000 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('Offset first');
});

describe('issue #094 — instrumental gap presentation', () => {
  const makeLyrics = (secondMs: number): LyricsData => ({
    synced: true,
    source: 'structured',
    offsetMs: 0,
    lines: [
      { startMs: 10000, text: 'First lyric' },
      { startMs: secondMs, text: 'Second lyric' },
    ],
  });

  test.each([18999, 19000, 19001])(
    'gap ending at %ims respects the nine-second threshold',
    (secondMs) => {
      playerStore.setState({ position: 14 });
      const view = render(
        <InlineLyricsPanel trackId="a" lyrics={makeLyrics(secondMs)} colors={colors} />
      );

      if (secondMs < 19000) {
        expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
          .toBe('First lyric');
      } else {
        expect(view.queryAllByText(/.+/)).toHaveLength(0);
      }
    }
  );

  test('three-second hold, blank interval and anticipation boundaries', () => {
    const view = render(
      <InlineLyricsPanel trackId="a" lyrics={makeLyrics(25000)} colors={colors} />
    );

    const setPosition = (seconds: number) =>
      act(() => playerStore.setState({ position: seconds }));

    setPosition(12.999);
    expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
      .toBe('First lyric');

    setPosition(13);
    expect(view.queryAllByText(/.+/)).toHaveLength(0);

    setPosition(21.999);
    expect(view.queryAllByText(/.+/)).toHaveLength(0);

    setPosition(22);
    expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel)
      .toBe('Second lyric');
    expect(view.queryByTestId('inline-lyrics-current')).toBeNull();

    setPosition(25);
    expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
      .toBe('Second lyric');
  });

  test('final lyric holds for five seconds, then clears', () => {
    playerStore.setState({ position: 25 });
    const view = render(
      <InlineLyricsPanel trackId="a" lyrics={makeLyrics(25000)} colors={colors} />
    );

    act(() => playerStore.setState({ position: 29.999 }));
    expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
      .toBe('Second lyric');

    act(() => playerStore.setState({ position: 30 }));
    expect(view.queryAllByText(/.+/)).toHaveLength(0);
    expect(view.getByTestId('inline-lyrics')).toBeTruthy();
  });
});

test('issue #094: blank timed entry does not tease a distant next lyric', () => {
  const gapLyrics: LyricsData = {
    synced: true,
    source: 'structured',
    offsetMs: 0,
    lines: [
      { startMs: 10000, text: 'Lyric A' },
      { startMs: 12000, text: '' },
      { startMs: 25000, text: 'Lyric B' },
    ],
  };

  playerStore.setState({ position: 10 });
  const view = render(
    <InlineLyricsPanel trackId="a" lyrics={gapLyrics} colors={colors} />
  );

  // A is active; the next entry is explicitly blank.
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('Lyric A');
  expect(view.queryByText('Lyric B')).toBeNull();

  // The blank entry becomes active, with A as previous context.
  // B must not be revealed early.
  act(() => playerStore.setState({ position: 12 }));
  expect(view.getByTestId('inline-lyrics-previous').props.accessibilityLabel)
    .toBe('Lyric A');
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('');
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel)
    .toBe('');

  // Three seconds after the blank entry, the panel clears.
  act(() => playerStore.setState({ position: 15 }));
  expect(view.queryByText('Lyric B')).toBeNull();
  expect(view.queryByTestId('inline-lyrics-current')).toBeNull();
  expect(view.getByTestId('inline-lyrics')).toBeTruthy();

  // B is revealed only at its proper anticipation boundary.
  act(() => playerStore.setState({ position: 21.999 }));
  expect(view.queryByText('Lyric B')).toBeNull();

  act(() => playerStore.setState({ position: 22 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel)
    .toBe('Lyric B');

  act(() => playerStore.setState({ position: 25 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('Lyric B');
});

test('issue #094: previous lyric does not reappear across an instrumental gap', () => {
  const gapLyrics: LyricsData = {
    synced: true,
    source: 'structured',
    offsetMs: 0,
    lines: [
      { startMs: 10000, text: 'Lyric A' },
      { startMs: 25000, text: 'Lyric B' },
      { startMs: 27000, text: 'Lyric C' },
    ],
  };

  playerStore.setState({ position: 10 });
  const view = render(
    <InlineLyricsPanel trackId="a" lyrics={gapLyrics} colors={colors} />
  );

  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('Lyric A');
  expect(view.queryByText('Lyric B')).toBeNull();

  act(() => playerStore.setState({ position: 13 }));
  expect(view.queryByText('Lyric A')).toBeNull();

  act(() => playerStore.setState({ position: 22 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel)
    .toBe('Lyric B');

  act(() => playerStore.setState({ position: 25 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('Lyric B');
  expect(view.getByTestId('inline-lyrics-previous').props.accessibilityLabel)
    .toBe('');
  expect(view.queryByText('Lyric A')).toBeNull();
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel)
    .toBe('Lyric C');

  // Normal short-gap context must still work.
  act(() => playerStore.setState({ position: 27 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel)
    .toBe('Lyric C');
  expect(view.getByTestId('inline-lyrics-previous').props.accessibilityLabel)
    .toBe('Lyric B');
});
