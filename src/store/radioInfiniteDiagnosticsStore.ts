import { create } from 'zustand';

import {
  clearRadioInfiniteLog,
  exportRadioInfiniteLog,
  getRadioInfiniteLogStatus,
  setRadioInfiniteLoggingEnabled,
} from '../services/radioInfiniteLogger';

interface RadioInfiniteDiagnosticsState {
  enabled: boolean;
  logFileSize: number | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  resetLog: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  exportLog: () => Promise<string | null>;
}

export const radioInfiniteDiagnosticsStore =
  create<RadioInfiniteDiagnosticsState>()((set, get) => ({
    enabled: false,
    logFileSize: null,

    setEnabled: async (enabled: boolean) => {
      await setRadioInfiniteLoggingEnabled(enabled);
      await get().refreshStatus();
    },

    resetLog: async () => {
      await clearRadioInfiniteLog();
      await get().refreshStatus();
    },

    refreshStatus: async () => {
      const status = await getRadioInfiniteLogStatus();
      if (status !== null) set(status);
    },

    exportLog: async () => {
      const uri = await exportRadioInfiniteLog();
      await get().refreshStatus();
      return uri;
    },
  }));
