import { isTabletScreen } from '../deviceLayout';

it('classifies device identity independently of orientation at the 600dp boundary', () => {
  expect(isTabletScreen(430, 932)).toBe(false);
  expect(isTabletScreen(932, 430)).toBe(false);
  expect(isTabletScreen(900, 599)).toBe(false);
  expect(isTabletScreen(900, 600)).toBe(true);
  expect(isTabletScreen(600, 900)).toBe(true);
});
