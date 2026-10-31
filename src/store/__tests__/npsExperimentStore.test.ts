jest.mock('../persistence/kvStorage', () => require('../persistence/__mocks__/kvStorage'));

import { npsExperimentStore } from '../npsExperimentStore';
import { kvStorage } from '../persistence/kvStorage';

it('persists the experiment selection and rehydrates without persisting manual orientation', async () => {
  npsExperimentStore.getState().setMode('automatic');
  const saved = JSON.parse((await kvStorage.getItem('substreamer-nps-experiment'))!);
  expect(saved.state).toEqual({ mode: 'automatic' });
  npsExperimentStore.setState({ mode: 'manual' });
  await kvStorage.setItem('substreamer-nps-experiment', JSON.stringify(saved));
  await npsExperimentStore.persist.rehydrate();
  expect(npsExperimentStore.getState().mode).toBe('automatic');
  npsExperimentStore.getState().setMode('manual');
  expect(npsExperimentStore.getState().mode).toBe('manual');
});
