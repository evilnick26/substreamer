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
  busy: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  resetLog: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  shareLog: (share: (uri: string) => Promise<void>) => Promise<void>;
}

export const radioInfiniteDiagnosticsStore =
  create<RadioInfiniteDiagnosticsState>()((set, get) => {
    const runAction = async (
      action: () => Promise<void>,
    ): Promise<void> => {
      if (get().busy) return;

      set({ busy: true });

      try {
        await action();
      } catch {
        // Diagnostic actions are best-effort.
      } finally {
        set({ busy: false });
      }
    };

    return {
      enabled: false,
      logFileSize: null,
      busy: false,

      setEnabled: async (enabled: boolean) => {
        await runAction(async () => {
          await setRadioInfiniteLoggingEnabled(enabled);
          await get().refreshStatus();
        });
      },

      resetLog: async () => {
        await runAction(async () => {
          await clearRadioInfiniteLog();
          await get().refreshStatus();
        });
      },

      refreshStatus: async () => {
        const status = await getRadioInfiniteLogStatus();
        if (status !== null) set(status);
      },

      shareLog: async (share) => {
        await runAction(async () => {
          const uri = await exportRadioInfiniteLog();
          await get().refreshStatus();

          if (uri !== null) {
            await share(uri);
          }
        });
      },
    };
  });
