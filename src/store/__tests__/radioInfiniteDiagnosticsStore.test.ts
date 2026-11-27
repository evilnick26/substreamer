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

  it('returns the exported URI and refreshes status', async () => {
    mockExport.mockResolvedValue('file:///mock/export.log');

    mockStatus.mockResolvedValue({
      enabled: true,
      logFileSize: 2048,
    });

    await expect(store.getState().exportLog()).resolves.toBe(
      'file:///mock/export.log',
    );

    expect(exportRadioInfiniteLog).toHaveBeenCalledTimes(1);
    expect(store.getState().logFileSize).toBe(2048);
  });

  it('returns null when no export is available', async () => {
    mockExport.mockResolvedValue(null);

    await expect(store.getState().exportLog()).resolves.toBeNull();

    expect(getRadioInfiniteLogStatus).toHaveBeenCalledTimes(1);
  });
});
