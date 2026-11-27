jest.mock('../../services/radioInfiniteLogger', () => ({
  clearRadioInfiniteLog: jest.fn(),
  exportRadioInfiniteLog: jest.fn(),
  getRadioInfiniteLogStatus: jest.fn(),
  setRadioInfiniteLoggingEnabled: jest.fn(),
}));

import {
  clearRadioInfiniteLog,
  exportRadioInfiniteLog,
  getRadioInfiniteLogStatus,
  setRadioInfiniteLoggingEnabled,
} from '../../services/radioInfiniteLogger';

import {
  radioInfiniteDiagnosticsStore as store,
} from '../radioInfiniteDiagnosticsStore';

const mockStatus = jest.mocked(getRadioInfiniteLogStatus);
const mockExport = jest.mocked(exportRadioInfiniteLog);

beforeEach(() => {
  jest.resetAllMocks();

  store.setState({
    enabled: false,
    logFileSize: null,
    busy: false,
  });

  mockStatus.mockResolvedValue({
    enabled: false,
    logFileSize: null,
  });
});

describe('Radio Infinite diagnostics store', () => {
  it('defaults to disabled with no retained logs', () => {
    expect(store.getState().enabled).toBe(false);
    expect(store.getState().logFileSize).toBeNull();
  });

  it('refreshes persisted logging status', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    await store.getState().refreshStatus();

    expect(store.getState().enabled).toBe(true);
    expect(store.getState().logFileSize).toBe(1024);
  });

  it('retains previous status when the filesystem cannot be read', async () => {
    store.setState({
      enabled: true,
      logFileSize: 1024,
    });

    mockStatus.mockResolvedValue(null);

    await store.getState().refreshStatus();

    expect(store.getState().enabled).toBe(true);
    expect(store.getState().logFileSize).toBe(1024);
  });

  it('enables logging and refreshes actual state', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: null,
    });

    await store.getState().setEnabled(true);

    expect(setRadioInfiniteLoggingEnabled).toHaveBeenCalledWith(true);
    expect(store.getState().enabled).toBe(true);
  });

  it('disables logging without discarding retained history', async () => {
    store.setState({ enabled: true });

    mockStatus.mockResolvedValue({
      enabled: false,
      logFileSize: 2048,
    });

    await store.getState().setEnabled(false);

    expect(setRadioInfiniteLoggingEnabled).toHaveBeenCalledWith(false);
    expect(store.getState().enabled).toBe(false);
    expect(store.getState().logFileSize).toBe(2048);
  });

  it('does not report enablement when the flag change fails', async () => {
    await store.getState().setEnabled(true);

    expect(store.getState().enabled).toBe(false);
  });

  it('clears retained logs and refreshes actual state', async () => {
    store.setState({
      enabled: true,
      logFileSize: 1024,
    });

    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: null,
    });

    await store.getState().resetLog();

    expect(clearRadioInfiniteLog).toHaveBeenCalledTimes(1);
    expect(store.getState().logFileSize).toBeNull();
    expect(store.getState().enabled).toBe(true);
  });

  it('does not falsely report successful clearing', async () => {
    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 1024,
    });

    await store.getState().resetLog();

    expect(store.getState().logFileSize).toBe(1024);
  });

  it('shares the exported URI and refreshes status', async () => {
    const share = jest.fn().mockResolvedValue(undefined);

    mockExport.mockResolvedValue('file:///mock/export.log');

    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 2048,
    });

    await store.getState().shareLog(share);

    expect(share).toHaveBeenCalledWith('file:///mock/export.log');
    expect(exportRadioInfiniteLog).toHaveBeenCalledTimes(1);
    expect(store.getState().logFileSize).toBe(2048);
    expect(store.getState().busy).toBe(false);
  });

  it('does not invoke sharing when no export is available', async () => {
    const share = jest.fn();

    mockExport.mockResolvedValue(null);

    await store.getState().shareLog(share);

    expect(share).not.toHaveBeenCalled();
    expect(getRadioInfiniteLogStatus).toHaveBeenCalledTimes(1);
    expect(store.getState().busy).toBe(false);
  });

  it('blocks overlapping actions throughout native sharing', async () => {
    mockExport.mockResolvedValue('file:///mock/export.log');

    let finishSharing!: () => void;
    let sharingStarted!: () => void;

    const started = new Promise<void>((resolve) => {
      sharingStarted = resolve;
    });

    const share = jest.fn(() => new Promise<void>((resolve) => {
      finishSharing = resolve;
      sharingStarted();
    }));

    const pending = store.getState().shareLog(share);

    expect(store.getState().busy).toBe(true);

    await started;

    await store.getState().shareLog(share);
    await store.getState().resetLog();
    await store.getState().setEnabled(false);

    expect(exportRadioInfiniteLog).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    expect(clearRadioInfiniteLog).not.toHaveBeenCalled();
    expect(setRadioInfiniteLoggingEnabled).not.toHaveBeenCalled();
    expect(store.getState().busy).toBe(true);

    finishSharing();
    await pending;

    expect(store.getState().busy).toBe(false);

    await store.getState().resetLog();

    expect(clearRadioInfiniteLog).toHaveBeenCalledTimes(1);
  });

  it('blocks sharing while clearing is in progress', async () => {
    let finishClear!: () => void;

    jest.mocked(clearRadioInfiniteLog).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishClear = resolve;
      }),
    );

    const pending = store.getState().resetLog();

    expect(store.getState().busy).toBe(true);

    await store.getState().shareLog(jest.fn());

    expect(exportRadioInfiniteLog).not.toHaveBeenCalled();

    finishClear();
    await pending;

    expect(store.getState().busy).toBe(false);
  });

  it('blocks overlapping enablement changes', async () => {
    let finishToggle!: () => void;

    jest.mocked(setRadioInfiniteLoggingEnabled).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishToggle = resolve;
      }),
    );

    const pending = store.getState().setEnabled(true);

    expect(store.getState().busy).toBe(true);

    await store.getState().setEnabled(false);

    expect(setRadioInfiniteLoggingEnabled).toHaveBeenCalledTimes(1);
    expect(setRadioInfiniteLoggingEnabled).toHaveBeenCalledWith(true);

    finishToggle();
    await pending;

    expect(store.getState().busy).toBe(false);
  });

  it('releases the busy state when native sharing fails', async () => {
    mockExport.mockResolvedValue('file:///mock/export.log');

    const share = jest.fn().mockRejectedValue(
      new Error('Sharing failed'),
    );

    await expect(store.getState().shareLog(share)).resolves.toBeUndefined();

    expect(store.getState().busy).toBe(false);

    await store.getState().resetLog();

    expect(clearRadioInfiniteLog).toHaveBeenCalledTimes(1);
  });

  it('releases the busy state when export fails unexpectedly', async () => {
    mockExport.mockRejectedValue(new Error('Export failed'));

    const share = jest.fn();

    await expect(store.getState().shareLog(share)).resolves.toBeUndefined();

    expect(share).not.toHaveBeenCalled();
    expect(store.getState().busy).toBe(false);
  });
});
