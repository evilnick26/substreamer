import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from './persistence';

export type NpsOrientationMode = 'automatic' | 'manual';

interface NpsExperimentState {
  mode: NpsOrientationMode;
  setMode: (mode: NpsOrientationMode) => void;
}

/** Temporary Android phone NPS experiment preference. */
export const npsExperimentStore = create<NpsExperimentState>()(
  persist(
    (set) => ({ mode: 'manual', setMode: (mode) => set({ mode }) }),
    {
      name: 'substreamer-nps-experiment',
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ mode }) => ({ mode }),
    },
  ),
);
