export const RELEASE_BASE_URL = 'https://updates.sancti.fi/client/';

type ReleaseChannel = 'alpha' | 'beta' | 'release';
export const CLIENT_UPDATE_CHANNEL: ReleaseChannel = 'alpha';
export const CLIENT_UPDATE_URL = `${RELEASE_BASE_URL}${CLIENT_UPDATE_CHANNEL}.json`;
