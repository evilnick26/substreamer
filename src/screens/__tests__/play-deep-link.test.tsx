import React from 'react';
import { render } from '@testing-library/react-native';
import { router } from 'expo-router';

import PlayDeepLinkRoute from '../../app/play';
import { dispatchVoiceSearchRequest } from '../../services/headlessMediaService';
import type { VoiceFields } from '../../services/voiceDeepLinkMapper';

let mockParams: VoiceFields = {};
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('../../services/headlessMediaService', () => ({ dispatchVoiceSearchRequest: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('voice media dispatch is unchanged and does not block the Library fallback', () => {
  mockParams = { artist: ' Nirvana ', song: ' Come As You Are ' };
  jest.mocked(dispatchVoiceSearchRequest).mockReturnValue(new Promise(() => {}));
  const { rerender } = render(<PlayDeepLinkRoute />);
  expect(dispatchVoiceSearchRequest).toHaveBeenCalledWith({
    query: 'Come As You Are', type: 'song', artist: 'Nirvana', song: 'Come As You Are',
    album: undefined, playlist: undefined, genre: undefined, origin: 'android-assistant',
  });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/library');
  expect(jest.mocked(dispatchVoiceSearchRequest).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(router.replace).mock.invocationCallOrder[0]);
  mockParams = { artist: 'Other artist' };
  rerender(<PlayDeepLinkRoute />);
  expect(dispatchVoiceSearchRequest).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledTimes(1);
});

test.each([{}, { artist: ' ', song: '' }])('empty media request still falls back to Library without dispatch', (params) => {
  mockParams = params;
  render(<PlayDeepLinkRoute />);
  expect(dispatchVoiceSearchRequest).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/library');
});
