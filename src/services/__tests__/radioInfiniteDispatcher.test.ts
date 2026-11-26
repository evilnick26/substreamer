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
