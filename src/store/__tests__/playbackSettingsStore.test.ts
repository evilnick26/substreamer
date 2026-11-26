jest.mock('../persistence/kvStorage', () => require('../persistence/__mocks__/kvStorage'));

import { FORMAT_PRESETS, migratePlaybackSettings, playbackSettingsStore } from '../playbackSettingsStore';
import { kvStorageSync } from '../persistence/kvStorage';

beforeEach(() => {
  playbackSettingsStore.setState({
    maxBitRate: null,
    streamFormat: 'raw',
    estimateContentLength: false,
    repeatMode: 'off',
    radioOfflineFallback: 'all',
    radioMinDuration: 90,
    radioMaxDuration: 480,
    playbackRate: 1,
    downloadMaxBitRate: 320,
    downloadFormat: 'mp3',
    showSkipIntervalButtons: true,
    showSleepTimerButton: true,
    skipBackwardInterval: 15,
    skipForwardInterval: 30,
    remoteControlMode: 'skip-track',
    artistPlayMode: 'topSongs',
  });
});

describe('playbackSettingsStore', () => {
  it('setMaxBitRate updates bitrate', () => {
    playbackSettingsStore.getState().setMaxBitRate(320);
    expect(playbackSettingsStore.getState().maxBitRate).toBe(320);
  });

  it('setMaxBitRate to null removes limit', () => {
    playbackSettingsStore.getState().setMaxBitRate(320);
    playbackSettingsStore.getState().setMaxBitRate(null);
    expect(playbackSettingsStore.getState().maxBitRate).toBeNull();
  });

  it('setStreamFormat updates format', () => {
    playbackSettingsStore.getState().setStreamFormat('mp3');
    expect(playbackSettingsStore.getState().streamFormat).toBe('mp3');
  });

  it('setEstimateContentLength updates flag', () => {
    playbackSettingsStore.getState().setEstimateContentLength(true);
    expect(playbackSettingsStore.getState().estimateContentLength).toBe(true);
  });

  it('setRepeatMode updates repeat mode', () => {
    playbackSettingsStore.getState().setRepeatMode('all');
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
  });

  it('defaults Radio Infinite offline fallback to Repeat All', () => {
    expect(playbackSettingsStore.getState().radioOfflineFallback).toBe('all');
  });

  it('supports Repeat Off as the Radio Infinite offline fallback', () => {
    playbackSettingsStore.getState().setRadioOfflineFallback('off');
    expect(playbackSettingsStore.getState().radioOfflineFallback).toBe('off');
    playbackSettingsStore.getState().setRadioOfflineFallback('all');
    expect(playbackSettingsStore.getState().radioOfflineFallback).toBe('all');
  });

  it('setPlaybackRate updates rate', () => {
    playbackSettingsStore.getState().setPlaybackRate(1.5);
    expect(playbackSettingsStore.getState().playbackRate).toBe(1.5);
  });

  it('setDownloadMaxBitRate updates download bitrate', () => {
    playbackSettingsStore.getState().setDownloadMaxBitRate(128);
    expect(playbackSettingsStore.getState().downloadMaxBitRate).toBe(128);
  });

  it('setDownloadFormat updates download format', () => {
    playbackSettingsStore.getState().setDownloadFormat('raw');
    expect(playbackSettingsStore.getState().downloadFormat).toBe('raw');
  });

  it('setShowSkipIntervalButtons updates flag', () => {
    playbackSettingsStore.getState().setShowSkipIntervalButtons(true);
    expect(playbackSettingsStore.getState().showSkipIntervalButtons).toBe(true);
  });

  it('setSkipBackwardInterval updates backward interval', () => {
    playbackSettingsStore.getState().setSkipBackwardInterval(30);
    expect(playbackSettingsStore.getState().skipBackwardInterval).toBe(30);
  });

  it('setSkipForwardInterval updates forward interval', () => {
    playbackSettingsStore.getState().setSkipForwardInterval(60);
    expect(playbackSettingsStore.getState().skipForwardInterval).toBe(60);
  });

  it('setRemoteControlMode updates remote control mode', () => {
    playbackSettingsStore.getState().setRemoteControlMode('skip-interval');
    expect(playbackSettingsStore.getState().remoteControlMode).toBe('skip-interval');
  });

  it('setShowSleepTimerButton updates flag', () => {
    playbackSettingsStore.getState().setShowSleepTimerButton(true);
    expect(playbackSettingsStore.getState().showSleepTimerButton).toBe(true);
  });

  it('setArtistPlayMode updates artist play mode', () => {
    playbackSettingsStore.getState().setArtistPlayMode('allSongs');
    expect(playbackSettingsStore.getState().artistPlayMode).toBe('allSongs');
  });

  it('setArtistPlayMode toggles back to topSongs', () => {
    playbackSettingsStore.getState().setArtistPlayMode('allSongs');
    playbackSettingsStore.getState().setArtistPlayMode('topSongs');
    expect(playbackSettingsStore.getState().artistPlayMode).toBe('topSongs');
  });

  it('defaults for skip interval fields', () => {
    const state = playbackSettingsStore.getState();
    // Sleep-timer + skip-interval buttons ship enabled by default so users
    // can find them (they're frequently requested when hidden).
    expect(state.showSkipIntervalButtons).toBe(true);
    expect(state.showSleepTimerButton).toBe(true);
    expect(state.skipBackwardInterval).toBe(15);
    expect(state.skipForwardInterval).toBe(30);
    expect(state.remoteControlMode).toBe('skip-track');
    expect(state.artistPlayMode).toBe('topSongs');
  });

  describe('migratePlaybackSettings (v0 → v1)', () => {
    it('force-enables both button flags for users upgrading from v0', () => {
      const result = migratePlaybackSettings(
        { showSkipIntervalButtons: false, showSleepTimerButton: false, repeatMode: 'all' },
        0,
      );
      expect(result.showSkipIntervalButtons).toBe(true);
      expect(result.showSleepTimerButton).toBe(true);
      // Unrelated settings are preserved.
      expect(result.repeatMode).toBe('all');
    });

    it('also runs when version is undefined (pre-versioned blob)', () => {
      const result = migratePlaybackSettings({ showSleepTimerButton: false }, undefined as any);
      expect(result.showSleepTimerButton).toBe(true);
    });

    it('leaves a v1+ blob untouched so later user changes persist', () => {
      const blob = { showSkipIntervalButtons: false, showSleepTimerButton: false };
      expect(migratePlaybackSettings(blob, 1)).toBe(blob);
    });

    it('preserves radio mode in a persisted v1 state', () => {
      const blob = { repeatMode: 'radio' };
      expect(migratePlaybackSettings(blob, 1)).toBe(blob);
      expect(migratePlaybackSettings(blob, 1).repeatMode).toBe('radio');
    });

    it('passes through a null/invalid blob unchanged', () => {
      expect(migratePlaybackSettings(null, 0)).toBeNull();
    });
  });

  describe('Radio Infinite duration settings (#95)', () => {
    const key = 'substreamer-playback-settings';

    const limits = () => {
      const state = playbackSettingsStore.getState();
      return [state.radioMinDuration, state.radioMaxDuration];
    };

    it('defaults to 90–480 seconds', () => {
      const state = playbackSettingsStore.getInitialState();
      expect(state.radioMinDuration).toBe(90);
      expect(state.radioMaxDuration).toBe(480);
    });

    it('accepts valid changes to both boundaries', () => {
      playbackSettingsStore.getState().setRadioMinDuration(30);
      playbackSettingsStore.getState().setRadioMaxDuration(900);
      expect(limits()).toEqual([30, 900]);
    });

    it('rejects a maximum below the current minimum', () => {
      playbackSettingsStore.getState().setRadioMaxDuration(60);
      expect(limits()).toEqual([90, 480]);
    });

    it('rejects a minimum above the current maximum', () => {
      playbackSettingsStore.getState().setRadioMaxDuration(120);
      playbackSettingsStore.getState().setRadioMinDuration(180);
      expect(limits()).toEqual([90, 120]);
    });

    it('accepts a minimum equal to the maximum', () => {
      playbackSettingsStore.getState().setRadioMaxDuration(120);
      playbackSettingsStore.getState().setRadioMinDuration(120);
      expect(limits()).toEqual([120, 120]);
    });

    it('accepts a maximum equal to the minimum', () => {
      playbackSettingsStore.getState().setRadioMinDuration(180);
      playbackSettingsStore.getState().setRadioMaxDuration(180);
      expect(limits()).toEqual([180, 180]);
    });

    it.each([-1, NaN, Infinity, -Infinity, 1.5])(
      'rejects invalid minimum %s',
      (value) => {
        playbackSettingsStore.getState().setRadioMinDuration(value);
        expect(limits()).toEqual([90, 480]);
      },
    );

    it.each([0, -1, NaN, Infinity, -Infinity, 90.5])(
      'rejects invalid maximum %s',
      (value) => {
        playbackSettingsStore.getState().setRadioMaxDuration(value);
        expect(limits()).toEqual([90, 480]);
      },
    );

    it('supports unrestricted duration limits', () => {
      playbackSettingsStore.getState().setRadioMinDuration(0);
      playbackSettingsStore.getState().setRadioMaxDuration(null);
      expect(limits()).toEqual([0, null]);
    });

    it('resets both limits atomically', () => {
      playbackSettingsStore.getState().setRadioMaxDuration(null);
      playbackSettingsStore.getState().setRadioMinDuration(600);
      playbackSettingsStore.getState().resetRadioDurationLimits();
      expect(limits()).toEqual([90, 480]);
    });

    it('persists custom values and the unlimited sentinel', async () => {
      playbackSettingsStore.getState().setRadioMinDuration(30);
      playbackSettingsStore.getState().setRadioMaxDuration(null);

      const saved = await kvStorageSync.getItem(key);
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!).state).toMatchObject({
        radioMinDuration: 30,
        radioMaxDuration: null,
      });

      playbackSettingsStore.getState().resetRadioDurationLimits();
      await kvStorageSync.setItem(key, saved!);
      await playbackSettingsStore.persist.rehydrate();

      expect(limits()).toEqual([30, null]);
    });

    it('uses defaults when hydrating an older settings blob', async () => {
      playbackSettingsStore.setState(
        playbackSettingsStore.getInitialState(),
        true,
      );
      await kvStorageSync.setItem(key, JSON.stringify({
        version: 1,
        state: { radioOfflineFallback: 'off' },
      }));

      await playbackSettingsStore.persist.rehydrate();

      expect(limits()).toEqual([90, 480]);
      expect(playbackSettingsStore.getState().radioOfflineFallback).toBe('off');
    });

    it.each([
      [300, 120],
      [-1, 480],
      [90, 0],
      ['90', 480],
      [90, '480'],
    ])('repairs invalid persisted limits %s / %s', async (min, max) => {
      await kvStorageSync.setItem(key, JSON.stringify({
        version: 1,
        state: {
          radioMinDuration: min,
          radioMaxDuration: max,
          radioOfflineFallback: 'off',
        },
      }));

      await playbackSettingsStore.persist.rehydrate();

      expect(limits()).toEqual([90, 480]);
      expect(playbackSettingsStore.getState().radioOfflineFallback).toBe('off');
    });
  });

  describe('format normalization', () => {
    it('lowercases and trims streamFormat input', () => {
      playbackSettingsStore.getState().setStreamFormat('  OPUS_128_CAR  ');
      expect(playbackSettingsStore.getState().streamFormat).toBe('opus_128_car');
    });

    it('lowercases and trims downloadFormat input', () => {
      playbackSettingsStore.getState().setDownloadFormat('  FLAC ');
      expect(playbackSettingsStore.getState().downloadFormat).toBe('flac');
    });

    it("preserves 'raw' as the canonical sentinel", () => {
      playbackSettingsStore.getState().setStreamFormat('raw');
      expect(playbackSettingsStore.getState().streamFormat).toBe('raw');
    });

    it('accepts arbitrary custom format strings', () => {
      playbackSettingsStore.getState().setStreamFormat('opus_192_rg');
      expect(playbackSettingsStore.getState().streamFormat).toBe('opus_192_rg');
    });
  });

  describe('FORMAT_PRESETS', () => {
    it('includes raw and flac as lossless with no high bitrate', () => {
      const raw = FORMAT_PRESETS.find((p) => p.value === 'raw');
      const flac = FORMAT_PRESETS.find((p) => p.value === 'flac');
      expect(raw?.lossless).toBe(true);
      expect(raw?.highBitrate).toBeNull();
      expect(flac?.lossless).toBe(true);
      expect(flac?.highBitrate).toBeNull();
    });

    it('marks all non-lossless presets with a numeric high bitrate', () => {
      const lossy = FORMAT_PRESETS.filter((p) => !p.lossless);
      expect(lossy.length).toBeGreaterThan(0);
      for (const preset of lossy) {
        expect(typeof preset.highBitrate).toBe('number');
      }
    });

    it('uses 192 high bitrate for opus_car (loudness-compressed profile)', () => {
      const opusCar = FORMAT_PRESETS.find((p) => p.value === 'opus_car');
      expect(opusCar?.highBitrate).toBe(192);
    });

    it('uses 320 high bitrate for the standard lossy presets', () => {
      const standardLossy = ['mp3', 'mp3_rg', 'mp3_car', 'aac', 'm4a', 'opus', 'opus_rg', 'ogg'];
      for (const value of standardLossy) {
        const preset = FORMAT_PRESETS.find((p) => p.value === value);
        expect(preset?.highBitrate).toBe(320);
      }
    });

    it('uses unique values across all presets', () => {
      const values = FORMAT_PRESETS.map((p) => p.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it('groups variants under their base codec', () => {
      const groupOf = (value: string) => FORMAT_PRESETS.find((p) => p.value === value)?.group;
      expect(groupOf('mp3')).toBe('mp3');
      expect(groupOf('mp3_rg')).toBe('mp3');
      expect(groupOf('mp3_car')).toBe('mp3');
      expect(groupOf('opus')).toBe('opus');
      expect(groupOf('opus_rg')).toBe('opus');
      expect(groupOf('opus_car')).toBe('opus');
      expect(groupOf('aac')).toBe('aac');
      expect(groupOf('m4a')).toBe('aac');
      expect(groupOf('ogg')).toBe('ogg');
      expect(groupOf('flac')).toBe('flac');
      expect(groupOf('raw')).toBe('raw');
    });

    it('keeps all presets within a group contiguous in the array', () => {
      const seenGroups = new Set<string>();
      let currentGroup: string | null = null;
      for (const preset of FORMAT_PRESETS) {
        if (preset.group !== currentGroup) {
          expect(seenGroups.has(preset.group)).toBe(false);
          seenGroups.add(preset.group);
          currentGroup = preset.group;
        }
      }
    });
  });
});
