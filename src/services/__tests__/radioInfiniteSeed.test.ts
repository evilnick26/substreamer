import {
  advanceRadioInfiniteSeed,
  buildRadioInfiniteSeedIds,
  createRadioInfiniteSeed,
  isValidRadioInfiniteSeed,
  RadioInfiniteSeedSession,
} from '../radioInfiniteSeed';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Radio Infinite seed lifecycle', () => {
  it.each([
    [0, 3],
    [0.32, 3],
    [0.34, 4],
    [0.65, 4],
    [0.67, 5],
    [0.999999, 5],
  ])('maps random value %s to lifespan %s', (random, lifespan) => {
    jest.spyOn(Math, 'random').mockReturnValue(random);

    expect(createRadioInfiniteSeed('primary')).toEqual({
      primarySeedId: 'primary',
      remainingRefills: lifespan,
    });
  });

  it('rejects an empty primary ID', () => {
    expect(() => createRadioInfiniteSeed('')).toThrow();
    expect(() => createRadioInfiniteSeed(' ')).toThrow();
  });

  it.each([1, 2, 3, 4, 5])(
    'accepts a persisted remaining lifespan of %s',
    (remainingRefills) => {
      expect(
        isValidRadioInfiniteSeed({
          primarySeedId: 'primary',
          remainingRefills,
        }),
      ).toBe(true);
    },
  );

  it.each([
    null,
    undefined,
    'primary',
    {},
    { primarySeedId: '', remainingRefills: 3 },
    { primarySeedId: ' ', remainingRefills: 3 },
    { primarySeedId: 123, remainingRefills: 3 },
    { primarySeedId: 'primary' },
    { primarySeedId: 'primary', remainingRefills: '3' },
    { primarySeedId: 'primary', remainingRefills: 0 },
    { primarySeedId: 'primary', remainingRefills: -1 },
    { primarySeedId: 'primary', remainingRefills: 6 },
    { primarySeedId: 'primary', remainingRefills: 2.5 },
    { primarySeedId: 'primary', remainingRefills: NaN },
    { primarySeedId: 'primary', remainingRefills: Infinity },
  ])('rejects invalid persisted state %#', (value) => {
    expect(isValidRadioInfiniteSeed(value)).toBe(false);
  });

  it('uses the primary followed by the last two queue IDs', () => {
    const seed = createRadioInfiniteSeed('primary');

    expect(
      buildRadioInfiniteSeedIds(seed, ['a', 'b', 'c', 'd']),
    ).toEqual(['primary', 'c', 'd']);
  });

  it('deduplicates IDs while retaining primary precedence', () => {
    const seed = createRadioInfiniteSeed('primary');

    expect(
      buildRadioInfiniteSeedIds(seed, ['a', 'b', 'primary']),
    ).toEqual(['primary', 'b']);

    expect(
      buildRadioInfiniteSeedIds(seed, ['a', 'a']),
    ).toEqual(['primary', 'a']);
  });

  it('handles short and empty queues', () => {
    const seed = createRadioInfiniteSeed('primary');

    expect(buildRadioInfiniteSeedIds(seed, [])).toEqual(['primary']);
    expect(buildRadioInfiniteSeedIds(seed, ['a'])).toEqual([
      'primary',
      'a',
    ]);
    expect(buildRadioInfiniteSeedIds(seed, ['primary'])).toEqual([
      'primary',
    ]);
  });

  it('does not consume lifespan for an empty append', () => {
    const seed = createRadioInfiniteSeed('primary');

    expect(advanceRadioInfiniteSeed(seed, [])).toBe(seed);
  });

  it.each([3, 4, 5])(
    'rotates after exactly %s successful refills',
    (lifespan) => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      let seed = {
        primarySeedId: 'original',
        remainingRefills: lifespan,
      };

      for (let i = 1; i < lifespan; i += 1) {
        seed = advanceRadioInfiniteSeed(seed, [`refill-${i}`]);

        expect(seed.primarySeedId).toBe('original');
        expect(seed.remainingRefills).toBe(lifespan - i);

        expect(advanceRadioInfiniteSeed(seed, [])).toBe(seed);
      }

      seed = advanceRadioInfiniteSeed(seed, ['first', 'second']);

      expect(seed).toEqual({
        primarySeedId: 'first',
        remainingRefills: 4,
      });
    },
  );

  it('counts a multi-track append as one successful refill', () => {
    const seed = {
      primarySeedId: 'primary',
      remainingRefills: 5,
    };

    expect(
      advanceRadioInfiniteSeed(seed, ['a', 'b', 'c']),
    ).toEqual({
      primarySeedId: 'primary',
      remainingRefills: 4,
    });

    expect(seed.remainingRefills).toBe(5);
  });
});

describe('Radio Infinite seed session', () => {
  it('starts without a primary', () => {
    const session = new RadioInfiniteSeedSession();

    expect(session.getSnapshot()).toEqual({
      seed: null,
      generation: 0,
    });

    expect(session.completeRefill(0, ['a'])).toBe(false);
  });

  it('invalidates old requests when a new primary is selected', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('old');
    const previous = session.getSnapshot();

    session.reset('new');
    const current = session.getSnapshot();

    expect(current.generation).toBe(previous.generation + 1);
    expect(current.seed?.primarySeedId).toBe('new');
    expect(session.completeRefill(previous.generation, ['a'])).toBe(false);
    expect(session.getSnapshot()).toEqual(current);
  });

  it('invalidates requests even when the same primary is reselected', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('primary');
    const previous = session.getSnapshot();

    session.reset('primary');

    expect(session.completeRefill(previous.generation, ['a'])).toBe(false);
  });

  it('invalidates outstanding requests when cleared', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('primary');
    const previous = session.getSnapshot();

    session.clear();

    expect(session.getSnapshot().seed).toBeNull();
    expect(session.completeRefill(previous.generation, ['a'])).toBe(false);
  });

  it('restores the exact remaining lifespan without rerandomising', () => {
    const random = jest.spyOn(Math, 'random');
    const session = new RadioInfiniteSeedSession();

    const persisted = {
      primarySeedId: 'restored',
      remainingRefills: 2,
    };

    expect(session.restore(persisted)).toBe(true);
    expect(session.getSnapshot().seed).toEqual(persisted);
    expect(session.getSnapshot().seed).not.toBe(persisted);
    expect(random).not.toHaveBeenCalled();
  });

  it('invalidates old requests when restoring a valid seed', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('old');
    const previous = session.getSnapshot();

    session.restore({
      primarySeedId: 'restored',
      remainingRefills: 2,
    });

    expect(session.completeRefill(previous.generation, ['a'])).toBe(false);
    expect(session.getSnapshot().seed?.primarySeedId).toBe('restored');
  });

  it('clears context when persisted state is invalid', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('primary');
    const previous = session.getSnapshot();

    expect(session.restore({ remainingRefills: 9 })).toBe(false);
    expect(session.getSnapshot().seed).toBeNull();
    expect(session.getSnapshot().generation).toBe(previous.generation + 1);
  });

  it('does not change state for an empty refill', () => {
    const session = new RadioInfiniteSeedSession();

    session.reset('primary');
    const previous = session.getSnapshot();

    expect(session.completeRefill(previous.generation, [])).toBe(false);
    expect(session.getSnapshot()).toEqual(previous);
  });

  it('decrements and rotates without changing session generation', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const session = new RadioInfiniteSeedSession();

    session.restore({
      primarySeedId: 'primary',
      remainingRefills: 2,
    });

    const { generation } = session.getSnapshot();

    expect(session.completeRefill(generation, ['a'])).toBe(true);
    expect(session.getSnapshot()).toEqual({
      seed: {
        primarySeedId: 'primary',
        remainingRefills: 1,
      },
      generation,
    });

    expect(session.completeRefill(generation, ['b', 'c'])).toBe(true);
    expect(session.getSnapshot()).toEqual({
      seed: {
        primarySeedId: 'b',
        remainingRefills: 3,
      },
      generation,
    });
  });
});

describe('Radio Infinite generation invalidation', () => {
  it('invalidates outstanding requests without discarding musical context', () => {
    const { RadioInfiniteSeedSession } = require('../radioInfiniteSeed');
    const session = new RadioInfiniteSeedSession();

    session.restore({
      primarySeedId: 'primary',
      remainingRefills: 2,
    });

    const previous = session.getSnapshot();

    session.invalidate();

    const current = session.getSnapshot();

    expect(current.seed).toEqual(previous.seed);
    expect(current.generation).toBe(previous.generation + 1);

    expect(
      session.completeRefill(previous.generation, ['stale']),
    ).toBe(false);

    expect(session.getSnapshot()).toEqual(current);
  });
});
