describe('Radio Infinite refill dispatcher', () => {
  it('does nothing before a handler is registered', () => {
    jest.isolateModules(() => {
      const { requestRadioInfiniteRefill } = require('../radioInfiniteDispatcher');

      expect(() => requestRadioInfiniteRefill()).not.toThrow();
    });
  });

  it('forwards refill requests to the registered handler', () => {
    jest.isolateModules(() => {
      const {
        registerRadioInfiniteRefillHandler,
        requestRadioInfiniteRefill,
      } = require('../radioInfiniteDispatcher');

      const handler = jest.fn();
      registerRadioInfiniteRefillHandler(handler);

      requestRadioInfiniteRefill();
      requestRadioInfiniteRefill();

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  it('replaces a previously registered handler', () => {
    jest.isolateModules(() => {
      const {
        registerRadioInfiniteRefillHandler,
        requestRadioInfiniteRefill,
      } = require('../radioInfiniteDispatcher');

      const first = jest.fn();
      const second = jest.fn();

      registerRadioInfiniteRefillHandler(first);
      registerRadioInfiniteRefillHandler(second);

      requestRadioInfiniteRefill();

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Radio Infinite queue transition protection', () => {
  it('suppresses requests until the transition ends', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);
      dispatcher.beginRadioQueueTransition();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(true);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).not.toHaveBeenCalled();

      dispatcher.endRadioQueueTransition();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(false);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps nested transitions protected until all have ended', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);
      dispatcher.beginRadioQueueTransition();
      dispatcher.beginRadioQueueTransition();

      dispatcher.endRadioQueueTransition();
      dispatcher.requestRadioInfiniteRefill();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(true);
      expect(handler).not.toHaveBeenCalled();

      dispatcher.endRadioQueueTransition();
      dispatcher.requestRadioInfiniteRefill();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('does not underflow the transition counter', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');

      dispatcher.endRadioQueueTransition();
      dispatcher.beginRadioQueueTransition();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(true);

      dispatcher.endRadioQueueTransition();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(false);
    });
  });
});

describe('Radio Infinite native queue certainty', () => {
  it('suppresses replenishment while the native queue is uncertain', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);

      expect(dispatcher.canRefillRadioInfinite()).toBe(true);

      dispatcher.markRadioQueueUncertain();

      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.requestRadioInfiniteRefill();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('permits replenishment after native queue synchronization', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);
      dispatcher.markRadioQueueUncertain();
      dispatcher.markRadioQueueSynchronized();

      expect(dispatcher.canRefillRadioInfinite()).toBe(true);

      dispatcher.requestRadioInfiniteRefill();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('requires both queue certainty and absence of active transitions', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);
      dispatcher.beginRadioQueueTransition();
      dispatcher.markRadioQueueUncertain();

      dispatcher.markRadioQueueSynchronized();

      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).not.toHaveBeenCalled();

      dispatcher.markRadioQueueUncertain();
      dispatcher.endRadioQueueTransition();

      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).not.toHaveBeenCalled();

      dispatcher.markRadioQueueSynchronized();

      expect(dispatcher.canRefillRadioInfinite()).toBe(true);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Radio Infinite native append coordination', () => {
  const dispatcher = require('../radioInfiniteDispatcher');

  beforeEach(() => {
    dispatcher.markRadioQueueSynchronized();
  });

  it('allows an append and returns its result', async () => {
    const operation = jest.fn(async () => ['a', 'b']);

    await expect(dispatcher.runRadioAppend(operation))
      .resolves.toEqual(['a', 'b']);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not start an append during a queue transition', async () => {
    const operation = jest.fn(async () => ['a']);

    dispatcher.beginRadioQueueTransition();

    try {
      await expect(dispatcher.runRadioAppend(operation))
        .resolves.toBeUndefined();

      expect(operation).not.toHaveBeenCalled();
    } finally {
      dispatcher.endRadioQueueTransition();
    }
  });

  it('does not start an append while the native queue is uncertain', async () => {
    const operation = jest.fn(async () => ['a']);

    dispatcher.markRadioQueueUncertain();

    try {
      await expect(dispatcher.runRadioAppend(operation))
        .resolves.toBeUndefined();

      expect(operation).not.toHaveBeenCalled();
    } finally {
      dispatcher.markRadioQueueSynchronized();
    }
  });

  it('waits for an active append and rejects overlapping appends', async () => {
    let finish!: () => void;

    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const first = dispatcher.runRadioAppend(async () => {
      await pending;
      return ['first'];
    });

    const secondOperation = jest.fn(async () => ['second']);

    let waiterFinished = false;

    const waiter = dispatcher.waitForRadioAppend().then(() => {
      waiterFinished = true;
    });

    try {
      await expect(dispatcher.runRadioAppend(secondOperation))
        .resolves.toBeUndefined();

      expect(secondOperation).not.toHaveBeenCalled();
      expect(waiterFinished).toBe(false);
    } finally {
      finish();
    }

    await expect(first).resolves.toEqual(['first']);
    await waiter;

    expect(waiterFinished).toBe(true);

    await expect(dispatcher.runRadioAppend(secondOperation))
      .resolves.toEqual(['second']);
  });

  it('releases waiting operations even when an append fails', async () => {
    let fail!: (error: Error) => void;

    const pending = new Promise<void>((_, reject) => {
      fail = reject;
    });

    const append = dispatcher.runRadioAppend(() => pending);
    const waiter = dispatcher.waitForRadioAppend();

    const rejection = expect(append).rejects.toThrow('Native failure');

    fail(new Error('Native failure'));

    await rejection;
    await expect(waiter).resolves.toBeUndefined();

    await expect(dispatcher.runRadioAppend(async () => ['next']))
      .resolves.toEqual(['next']);
  });

  it('does not block when no append is active', async () => {
    await expect(dispatcher.waitForRadioAppend())
      .resolves.toBeUndefined();
  });
});

describe('Radio Infinite ordinary queue mutation protection', () => {
  it('suppresses refills without marking a replacement transition active', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);
      dispatcher.beginRadioQueueMutation();

      expect(dispatcher.isRadioQueueTransitionActive()).toBe(false);
      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).not.toHaveBeenCalled();

      dispatcher.endRadioQueueMutation();

      expect(dispatcher.canRefillRadioInfinite()).toBe(true);

      expect(handler).toHaveBeenCalledTimes(1);

      dispatcher.requestRadioInfiniteRefill();
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  it('protects nested ordinary queue mutations', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');

      dispatcher.beginRadioQueueMutation();
      dispatcher.beginRadioQueueMutation();

      dispatcher.endRadioQueueMutation();
      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.endRadioQueueMutation();
      expect(dispatcher.canRefillRadioInfinite()).toBe(true);
    });
  });

  it('does not underflow the mutation counter', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');

      dispatcher.endRadioQueueMutation();
      dispatcher.beginRadioQueueMutation();

      expect(dispatcher.canRefillRadioInfinite()).toBe(false);

      dispatcher.endRadioQueueMutation();

      expect(dispatcher.canRefillRadioInfinite()).toBe(true);
    });
  });
});

describe('Radio Infinite queue revision', () => {
  it('advances immediately when a replacement transition begins', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const previous = dispatcher.getRadioQueueRevision();

      dispatcher.beginRadioQueueTransition();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 1);

      dispatcher.endRadioQueueTransition();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 1);
    });
  });

  it('advances immediately when an ordinary mutation begins', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const previous = dispatcher.getRadioQueueRevision();

      dispatcher.beginRadioQueueMutation();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 1);

      dispatcher.endRadioQueueMutation();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 1);
    });
  });

  it('never restores an earlier revision after nested mutations', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const previous = dispatcher.getRadioQueueRevision();

      dispatcher.beginRadioQueueMutation();
      dispatcher.beginRadioQueueTransition();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 2);

      dispatcher.endRadioQueueTransition();
      dispatcher.endRadioQueueMutation();

      expect(dispatcher.getRadioQueueRevision()).toBe(previous + 2);
    });
  });
});

describe('Radio Infinite replenishment after queue mutation', () => {
  it('reassesses replenishment after the outermost mutation completes', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);

      dispatcher.beginRadioQueueMutation();
      dispatcher.beginRadioQueueMutation();

      dispatcher.endRadioQueueMutation();

      expect(handler).not.toHaveBeenCalled();

      dispatcher.endRadioQueueMutation();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('does not request replenishment while a replacement is active', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);

      dispatcher.beginRadioQueueTransition();
      dispatcher.beginRadioQueueMutation();

      dispatcher.endRadioQueueMutation();

      expect(handler).not.toHaveBeenCalled();

      dispatcher.endRadioQueueTransition();
    });
  });

  it('does not request replenishment when the native queue is uncertain', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);

      dispatcher.beginRadioQueueMutation();
      dispatcher.markRadioQueueUncertain();

      dispatcher.endRadioQueueMutation();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('does not request replenishment for an unmatched mutation end', () => {
    jest.isolateModules(() => {
      const dispatcher = require('../radioInfiniteDispatcher');
      const handler = jest.fn();

      dispatcher.registerRadioInfiniteRefillHandler(handler);

      dispatcher.endRadioQueueMutation();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
