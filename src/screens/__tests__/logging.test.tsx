import React from 'react';
import { ActivityIndicator, Switch } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { shareAsync } from 'expo-sharing';

import { LoggingScreen } from '../logging';
import { audioDiagnosticsStore } from '../../store/audioDiagnosticsStore';
import { remoteControlDiagnosticsStore } from '../../store/remoteControlDiagnosticsStore';
import { imageCacheDiagnosticsStore } from '../../store/imageCacheDiagnosticsStore';
import { librarySyncDiagnosticsStore } from '../../store/librarySyncDiagnosticsStore';
import { voiceSearchDiagnosticsStore } from '../../store/voiceSearchDiagnosticsStore';
import { IMAGE_CACHE_DIAG_LOG_FILE } from '../../services/imageCacheLogger';
import { LIBRARY_SYNC_DIAG_LOG_FILE } from '../../services/librarySyncLogger';
import { VOICE_SEARCH_DIAG_LOG_FILE } from '../../services/voiceSearchLogger';
import { formatBytes } from '../../utils/formatters';
import { radioInfiniteDiagnosticsStore as store } from '../../store/radioInfiniteDiagnosticsStore';
import {
  clearRadioInfiniteLog,
  exportRadioInfiniteLog,
  getRadioInfiniteLogStatus,
  setRadioInfiniteLoggingEnabled,
} from '../../services/radioInfiniteLogger';

const mockFiles = new Map<string, string>();
const mockReadFile = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: {
    document: '/mock/document',
    cache: '/mock/cache',
  },
  File: class {
    private directory: string;
    private name: string;

    constructor(directory: string, name: string) {
      this.directory = directory;
      this.name = name;
    }

    get exists() {
      return mockFiles.has(this.name);
    }

    get uri() {
      return `file://${this.directory}/${this.name}`;
    }

    text() {
      return mockReadFile(this.name);
    }

    delete() {
      mockFiles.delete(this.name);
    }
  },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

jest.mock('../../services/radioInfiniteLogger', () => ({
  clearRadioInfiniteLog: jest.fn(),
  exportRadioInfiniteLog: jest.fn(),
  getRadioInfiniteLogStatus: jest.fn(),
  setRadioInfiniteLoggingEnabled: jest.fn(),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#0077ff',
      textPrimary: '#111111',
      textSecondary: '#888888',
      card: '#ffffff',
      border: '#cccccc',
      label: '#333333',
      red: '#ff0000',
    },
  }),
}));

jest.mock('../../components/GradientBackground', () => ({
  GradientBackground: ({ children }: {
    children: React.ReactNode;
  }) => children,
}));

jest.mock('../../components/BottomChrome', () => ({
  BottomChrome: () => null,
}));

jest.mock('../../store/audioDiagnosticsStore', () => {
  const state = {
    enabled: false,
    logFileSize: null as number | null,
    refreshStatus: jest.fn(),
    setEnabled: jest.fn(),
    resetLog: jest.fn(),
  };
  return {
    audioDiagnosticsStore: Object.assign(
      (select: (s: typeof state) => unknown) => select(state),
      { getState: () => state },
    ),
  };
});

jest.mock('../../store/remoteControlDiagnosticsStore', () => {
  const state = {
    enabled: false,
    logFileSize: null as number | null,
    refreshStatus: jest.fn(),
    setEnabled: jest.fn(),
    resetLog: jest.fn(),
  };
  return {
    remoteControlDiagnosticsStore: Object.assign(
      (select: (s: typeof state) => unknown) => select(state),
      { getState: () => state },
    ),
  };
});

jest.mock('../../store/imageCacheDiagnosticsStore', () => {
  const state = {
    enabled: false,
    logFileSize: null as number | null,
    refreshStatus: jest.fn(),
    setEnabled: jest.fn(),
    resetLog: jest.fn(),
  };
  return {
    imageCacheDiagnosticsStore: Object.assign(
      (select: (s: typeof state) => unknown) => select(state),
      { getState: () => state },
    ),
  };
});

jest.mock('../../store/librarySyncDiagnosticsStore', () => {
  const state = {
    enabled: false,
    logFileSize: null as number | null,
    refreshStatus: jest.fn(),
    setEnabled: jest.fn(),
    resetLog: jest.fn(),
  };
  return {
    librarySyncDiagnosticsStore: Object.assign(
      (select: (s: typeof state) => unknown) => select(state),
      { getState: () => state },
    ),
  };
});

jest.mock('../../store/voiceSearchDiagnosticsStore', () => {
  const state = {
    enabled: false,
    logFileSize: null as number | null,
    refreshStatus: jest.fn(),
    setEnabled: jest.fn(),
    resetLog: jest.fn(),
  };
  return {
    voiceSearchDiagnosticsStore: Object.assign(
      (select: (s: typeof state) => unknown) => select(state),
      { getState: () => state },
    ),
  };
});

const inheritedDiagnostics = [
  {
    title: 'Player Logging',
    store: audioDiagnosticsStore,
    filename: 'audio-diagnostics.log',
  },
  {
    title: 'Remote Control Diagnostics',
    store: remoteControlDiagnosticsStore,
    filename: 'remote-control-diagnostics.log',
  },
  {
    title: 'Voice Search Diagnostics',
    store: voiceSearchDiagnosticsStore,
    filename: VOICE_SEARCH_DIAG_LOG_FILE,
  },
  {
    title: 'Library Sync Diagnostics',
    store: librarySyncDiagnosticsStore,
    filename: LIBRARY_SYNC_DIAG_LOG_FILE,
  },
  {
    title: 'Image Cache Diagnostics',
    store: imageCacheDiagnosticsStore,
    filename: IMAGE_CACHE_DIAG_LOG_FILE,
  },
];

const mockStatus = jest.mocked(getRadioInfiniteLogStatus);
const mockExport = jest.mocked(exportRadioInfiniteLog);
const mockShare = jest.mocked(shareAsync);

const radioSwitch = () => {
  const switches = screen.UNSAFE_getAllByType(Switch).filter(
    (toggle) => toggle.props.accessibilityLabel === 'Radio Infinite Logging',
  );

  expect(switches).toHaveLength(1);

  return switches[0];
};

const shareButton = () =>
  screen.getByTestId('radio-infinite-share-log');

const clearButton = () =>
  screen.getByTestId('radio-infinite-clear-log');

async function renderLogging() {
  const result = render(<LoggingScreen />);
  await act(async () => {});
  return result;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockFiles.clear();

  mockReadFile.mockImplementation(
    async (name: string) => mockFiles.get(name) ?? '',
  );

  for (const diagnostic of inheritedDiagnostics) {
    const state = diagnostic.store.getState();
    state.enabled = false;
    state.logFileSize = null;
  }

  store.setState({
    enabled: false,
    logFileSize: null,
    busy: false,
  });

  mockStatus.mockResolvedValue({
    enabled: false,
    logFileSize: null,
  });

  mockExport.mockResolvedValue(null);
  mockShare.mockResolvedValue(undefined);
});

describe('Radio Infinite Logging screen integration', () => {
  it('shows the diagnostics card with logging disabled by default', async () => {
    await renderLogging();

    expect(screen.getByText('Radio Infinite Diagnostics')).toBeTruthy();
    expect(radioSwitch().props.value).toBe(false);
    expect(shareButton()).toBeDisabled();
    expect(clearButton()).toBeDisabled();
  });

  it('refreshes and displays persisted diagnostic status', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    await renderLogging();

    expect(radioSwitch().props.value).toBe(true);
    expect(shareButton()).toBeEnabled();
    expect(clearButton()).toBeEnabled();
    expect(getRadioInfiniteLogStatus).toHaveBeenCalled();
  });

  it('enables logging through the switch', async () => {
    await renderLogging();

    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: null,
    });

    await act(async () => {
      fireEvent(radioSwitch(), 'valueChange', true);
    });

    expect(setRadioInfiniteLoggingEnabled).toHaveBeenCalledWith(true);
    expect(radioSwitch().props.value).toBe(true);
  });

  it('allows retained logs to be shared when logging is disabled', async () => {
    mockStatus.mockResolvedValue({
      enabled: false,
      logFileSize: 1024,
    });

    mockExport.mockResolvedValue('file:///mock/export.log');

    await renderLogging();

    expect(radioSwitch().props.value).toBe(false);
    expect(shareButton()).toBeEnabled();

    await act(async () => {
      fireEvent.press(shareButton());
    });

    expect(mockShare).toHaveBeenCalledWith(
      'file:///mock/export.log',
      { mimeType: 'text/plain' },
    );
  });

  it('clears retained logs without disabling logging', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    await renderLogging();

    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: null,
    });

    await act(async () => {
      fireEvent.press(clearButton());
    });

    expect(clearRadioInfiniteLog).toHaveBeenCalledTimes(1);
    expect(radioSwitch().props.value).toBe(true);
    expect(shareButton()).toBeDisabled();
    expect(clearButton()).toBeDisabled();
  });

  it('does not invoke native sharing when export is unavailable', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    await renderLogging();

    await act(async () => {
      fireEvent.press(shareButton());
    });

    expect(mockShare).not.toHaveBeenCalled();
    expect(shareButton()).toBeEnabled();
  });

  it('protects the export across screen remounts during sharing', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    mockExport.mockResolvedValue('file:///mock/export.log');

    let finishSharing!: () => void;

    mockShare.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishSharing = resolve;
      }),
    );

    const first = await renderLogging();

    await act(async () => {
      fireEvent.press(shareButton());
    });

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(store.getState().busy).toBe(true);
    expect(radioSwitch().props.disabled).toBe(true);
    expect(shareButton()).toBeDisabled();
    expect(clearButton()).toBeDisabled();

    first.unmount();

    await renderLogging();

    expect(radioSwitch().props.disabled).toBe(true);
    expect(shareButton()).toBeDisabled();
    expect(clearButton()).toBeDisabled();

    await act(async () => {
      finishSharing();
    });

    expect(store.getState().busy).toBe(false);
    expect(radioSwitch().props.disabled).toBe(false);
    expect(shareButton()).toBeEnabled();
    expect(clearButton()).toBeEnabled();
  });

  it('restores controls when native sharing fails', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    mockExport.mockResolvedValue('file:///mock/export.log');
    mockShare.mockRejectedValueOnce(new Error('Sharing failed'));

    await renderLogging();

    await act(async () => {
      fireEvent.press(shareButton());
    });

    expect(store.getState().busy).toBe(false);
    expect(shareButton()).toBeEnabled();
    expect(clearButton()).toBeEnabled();
  });
});

function diagnosticSection(title: string) {
  let section = screen.getByText(title).parent;

  while (section) {
    const queries = within(section);

    if (
      queries.queryAllByText('Share').length === 1 &&
      queries.queryAllByText('Clear').length === 1
    ) {
      return queries;
    }

    section = section.parent;
  }

  throw new Error(`Missing diagnostic section: ${title}`);
}

describe.each(inheritedDiagnostics)(
  '$title regression coverage',
  ({ title, store: inheritedStore, filename }) => {
    it('refreshes status and delegates enablement changes', async () => {
      const state = inheritedStore.getState();

      await renderLogging();

      const section = diagnosticSection(title);
      const toggle = section.UNSAFE_getByType(Switch);

      expect(state.refreshStatus).toHaveBeenCalledTimes(1);
      expect(toggle.props.value).toBe(false);

      await act(async () => {
        fireEvent(toggle, 'valueChange', true);
      });

      expect(state.setEnabled).toHaveBeenCalledWith(true);

      await act(async () => {
        fireEvent(toggle, 'valueChange', false);
      });

      expect(state.setEnabled).toHaveBeenCalledWith(false);
    });

    it('displays retained log size and delegates sharing and clearing', async () => {
      const state = inheritedStore.getState();

      state.enabled = true;
      state.logFileSize = 4096;

      mockFiles.set(filename, 'Diagnostic history');

      await renderLogging();

      const section = diagnosticSection(title);

      expect(section.UNSAFE_getByType(Switch).props.value).toBe(true);
      expect(section.getByText(formatBytes(4096))).toBeTruthy();

      await act(async () => {
        fireEvent.press(section.getByText('Share'));
      });

      expect(mockShare).toHaveBeenCalledWith(
        `file:///mock/document/${filename}`,
        { mimeType: 'text/plain' },
      );

      await act(async () => {
        fireEvent.press(section.getByText('Clear'));
      });

      expect(state.resetLog).toHaveBeenCalledTimes(1);
    });

    it('does not share a file that has disappeared', async () => {
      inheritedStore.getState().logFileSize = 4096;

      await renderLogging();

      const section = diagnosticSection(title);

      await act(async () => {
        fireEvent.press(section.getByText('Share'));
      });

      expect(mockShare).not.toHaveBeenCalled();
    });
  },
);

describe('Migration log regression coverage', () => {
  const filename = 'migration-log.txt';

  it('shows a loading indicator until the migration log has been read', async () => {
    mockFiles.set(filename, 'Migration completed');

    let finishRead!: (text: string) => void;

    mockReadFile.mockImplementationOnce(
      () => new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
    );

    render(<LoggingScreen />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText('Migration completed')).toBeNull();

    await act(async () => {
      finishRead('Migration completed');
    });

    expect(screen.getByText('Migration completed')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });

  it('displays, shares and clears an existing migration log', async () => {
    mockFiles.set(filename, 'Migration completed');

    await renderLogging();

    expect(screen.getByText('Migration completed')).toBeTruthy();

    const section = diagnosticSection('Migration Log');

    await act(async () => {
      fireEvent.press(section.getByText('Share'));
    });

    expect(mockShare).toHaveBeenCalledWith(
      'file:///mock/document/migration-log.txt',
      { mimeType: 'text/plain' },
    );

    await act(async () => {
      fireEvent.press(section.getByText('Clear'));
    });

    expect(mockFiles.has(filename)).toBe(false);
    expect(screen.queryByText('Migration completed')).toBeNull();
  });

  it('does not share or delete a migration log that has disappeared', async () => {
    mockFiles.set(filename, 'Migration completed');

    await renderLogging();

    mockFiles.delete(filename);

    const section = diagnosticSection('Migration Log');

    await act(async () => {
      fireEvent.press(section.getByText('Share'));
      fireEvent.press(section.getByText('Clear'));
    });

    expect(mockShare).not.toHaveBeenCalled();
    expect(screen.getByText('Migration completed')).toBeTruthy();
  });
});
