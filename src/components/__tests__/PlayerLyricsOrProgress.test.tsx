jest.mock('../../store/persistence/lyricsTable', () => ({
  loadLyricsSync: jest.fn(() => null), loadLyrics: jest.fn(async () => null),
  saveLyrics: jest.fn(async () => {}), clearAllLyrics: jest.fn(), deleteLyrics: jest.fn(),
}));
jest.mock('../../services/subsonicService', () => ({ getLyricsForTrack: jest.fn() }));
jest.mock('../../store/persistence/kvStorage', () => require('../../store/persistence/__mocks__/kvStorage'));

jest.mock('../InlineLyricsPanel', () => {
  const React = require('react');
  const actual = jest.requireActual('../InlineLyricsPanel');
  return { InlineLyricsPanel: (props: { trackId: string }) => {
    React.useLayoutEffect(() => {
      mockCommits.push(`lyrics:${props.trackId}`);
      const resolve = mockBeforeCommit;
      mockBeforeCommit = undefined;
      resolve?.();
    });
    return React.createElement(actual.InlineLyricsPanel, props);
  } };
});

import { useLayoutEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { PlayerLyricsOrProgress } from '../PlayerLyricsOrProgress';
import { usePlayerLyrics } from '../../hooks/usePlayerLyrics';
import { playerStore } from '../../store/playerStore';
import { layoutPreferencesStore } from '../../store/layoutPreferencesStore';
import { lyricsStore } from '../../store/lyricsStore';
import { appStateStore } from '../../store/appStateStore';
import { deleteLyrics, loadLyricsSync } from '../../store/persistence/lyricsTable';
import { getLyricsForTrack, type LyricsData, type Child } from '../../services/subsonicService';
import type { ThemeColors } from '../../constants/theme';

const timed = (text: string): LyricsData => ({ synced: true, source: 'structured', offsetMs: 0,
  lines: [{ startMs: 1000, text }, { startMs: 2000, text: '' }, { startMs: 120000, text: 'Last' }] });
const colors = { textPrimary: '#fff', textSecondary: '#aaa' } as ThemeColors;
const mockCommits: string[] = [];
let mockBeforeCommit: (() => void) | undefined;
function Progress({ id }: { id: string }) {
  useLayoutEffect(() => { mockCommits.push(`progress:${id}`); });
  return <Text testID="progress">Progress</Text>;
}
function Surface({ id }: { id: string }) {
  const { entry } = usePlayerLyrics(id, 'Artist', 'Title', true);
  return <PlayerLyricsOrProgress trackId={id} lyrics={entry} colors={colors}>
    <Progress id={id} />
  </PlayerLyricsOrProgress>;
}
function Screen({ id }: { id: string }) {
  return <Surface id={id} />;
}
const originalFetch = lyricsStore.getState().fetchLyrics;
beforeEach(() => {
  jest.clearAllMocks(); mockCommits.length = 0; mockBeforeCommit = undefined;
  lyricsStore.setState({ entries: {}, loading: {}, errors: {}, revision: 0, fetchLyrics: originalFetch });
  layoutPreferencesStore.setState({ displaySyncedLyricsInNps: true });
  appStateStore.setState({ isActive: true });
  playerStore.setState({ currentTrack: { id: 'a' } as Child, position: 1 });
  jest.mocked(loadLyricsSync).mockReturnValue(null);
  jest.mocked(getLyricsForTrack).mockResolvedValue(null);
});

test('cached synced-to-synced has no intermediate progress commit and no outgoing text', () => {
  lyricsStore.setState({ entries: { a: timed('First, Original!'), b: timed('Second') } });
  const view = render(<Screen id="a" />);
  expect(view.getByText('First, Original!')).toBeTruthy();
  act(() => playerStore.setState({ currentTrack: { id: 'b' } as Child }));
  expect(view.queryByText('First, Original!')).toBeNull();
  view.rerender(<Screen id="b" />);
  expect(view.queryByText('First, Original!')).toBeNull();
  expect(view.getByText('Second')).toBeTruthy();
  expect(mockCommits.every((mode) => mode?.startsWith('lyrics:'))).toBe(true);
  expect(getLyricsForTrack).not.toHaveBeenCalled();
});

test('SQLite cache chooses lyrics on first commit and does not fetch again', () => {
  jest.mocked(loadLyricsSync).mockImplementation((id) => timed(id));
  const view = render(<Screen id="a" />);
  view.rerender(<Screen id="b" />);
  expect(mockCommits.length).toBeGreaterThan(1);
  expect(mockCommits.every((mode) => mode?.startsWith('lyrics:'))).toBe(true);
  expect(view.queryByTestId('progress')).toBeNull();
  expect(getLyricsForTrack).not.toHaveBeenCalled();
});

test('unknown resolves once; late previous-track response cannot change current mode', async () => {
  let finishA!: (data: LyricsData) => void;
  let finishB!: (data: LyricsData) => void;
  jest.mocked(getLyricsForTrack)
    .mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve as typeof finishA; }))
    .mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve as typeof finishB; }));
  const view = render(<Screen id="a" />);
  await act(async () => {});
  view.rerender(<Screen id="b" />);
  await act(async () => {});
  await act(async () => finishA(timed('STALE')));
  expect(view.getByTestId('progress')).toBeTruthy();
  await act(async () => finishB(timed('Current')));
  expect(view.queryByTestId('progress')).toBeNull();
  expect(view.queryByText('STALE')).toBeNull();
  const modes = mockCommits.map((s) => s?.split(':')[0]).filter((s, i, a) => s !== a[i - 1]);
  expect(modes).toEqual(['progress', 'lyrics']);
});

test('line changes, blank timed entry, pause, offset and seek never change mode', () => {
  lyricsStore.setState({ entries: { a: timed('Original') } });
  const view = render(<Screen id="a" />);
  act(() => playerStore.setState({ position: 80, playbackState: 'paused' }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('');
  act(() => playerStore.setState({ position: 121 }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('Last');
  act(() => playerStore.setState({ position: 0 }));
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe('Original');
  expect(view.queryByTestId('progress')).toBeNull();
  expect(mockCommits.every((s) => s === 'lyrics:a')).toBe(true);
});

test('unsynced, synthetic, unavailable and OFF retain the original component', async () => {
  lyricsStore.setState({ entries: { a: { ...timed('plain'), synced: false } } });
  const view = render(<Screen id="a" />);
  expect(view.getByTestId('progress')).toBeTruthy();
  act(() => lyricsStore.setState({ entries: { a: { ...timed('fake'), source: 'fake' } } }));
  expect(view.getByTestId('progress')).toBeTruthy();
  act(() => lyricsStore.setState({ entries: { a: timed('real') } }));
  act(() => layoutPreferencesStore.getState().setDisplaySyncedLyricsInNps(false));
  expect(view.getByTestId('progress')).toBeTruthy();
  expect(view.queryByTestId('inline-lyrics')).toBeNull();
  view.rerender(<Screen id="missing" />);
  await act(async () => {});
  expect(view.getByTestId('progress')).toBeTruthy();
});

test('cache removal does not resurrect the synchronous snapshot', async () => {
  jest.mocked(loadLyricsSync).mockReturnValue(timed('Cached'));
  jest.mocked(deleteLyrics).mockImplementation(async () => { jest.mocked(loadLyricsSync).mockReturnValue(null); });
  const view = render(<Screen id="a" />);
  await act(async () => lyricsStore.getState().removeLyrics('a'));
  expect(view.queryByText('Cached')).toBeNull();
  expect(view.getByTestId('progress')).toBeTruthy();
});

test('visual truncation preserves complete contextual data and active text with offset', () => {
  const previous = 'An unusually long previous entry, With Original Punctuation!';
  const next = 'The next contextual entry is complete in the source';
  lyricsStore.setState({ entries: { a: { ...timed('unused'), offsetMs: 500, lines: [
    { startMs: 0, text: previous }, { startMs: 1000, text: 'Current Case!' },
    { startMs: 2000, text: next },
  ] } } });
  playerStore.setState({ position: 1.5 });
  const view = render(<Screen id="a" />);
  expect(view.getByTestId('inline-lyrics-previous').props.numberOfLines).toBe(1);
  expect(view.getByTestId('inline-lyrics-previous').props.accessibilityLabel).toBe(previous);
  expect(view.getByTestId('inline-lyrics-current').props.numberOfLines).toBe(2);
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe('Current Case!');
  expect(view.getByTestId('inline-lyrics-next').props.accessibilityLabel).toBe(next);
  const count = mockCommits.length;
  act(() => playerStore.setState({ position: 1.6 }));
  expect(mockCommits).toHaveLength(count);
  act(() => appStateStore.setState({ isActive: false }));
  act(() => playerStore.setState({ position: 2.7 }));
  act(() => appStateStore.setState({ isActive: true }));
  expect(view.getByTestId('inline-lyrics-current').props.accessibilityLabel).toBe(next);
});


test('an unrelated late result between disk-cache render and adoption cannot flash progress', () => {
  jest.mocked(loadLyricsSync).mockImplementation((id) => id === 'b' ? timed('Disk B') : null);
  mockBeforeCommit = () => lyricsStore.setState((s) => ({
    entries: { ...s.entries, a: timed('Late A') }, revision: s.revision + 1,
  }));
  const view = render(<Screen id="b" />);
  expect(view.queryByTestId('progress')).toBeNull();
  expect(mockCommits.every((mode) => mode === 'lyrics:b')).toBe(true);
});
