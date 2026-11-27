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
