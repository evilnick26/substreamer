type RadioInfiniteRefillHandler = () => void;

let refillHandler: RadioInfiniteRefillHandler | null = null;

export function registerRadioInfiniteRefillHandler(
  handler: RadioInfiniteRefillHandler,
): void {
  refillHandler = handler;
}

export function requestRadioInfiniteRefill(): void {
  refillHandler?.();
}
