type RadioInfiniteRefillHandler = () => void;

let refillHandler: RadioInfiniteRefillHandler | null = null;

export function registerRadioInfiniteRefillHandler(
  handler: RadioInfiniteRefillHandler,
): void {
  refillHandler = handler;
}

let queueTransitionDepth = 0;

export function beginRadioQueueTransition(): void {
  queueTransitionDepth += 1;
}

export function endRadioQueueTransition(): void {
  queueTransitionDepth = Math.max(0, queueTransitionDepth - 1);
}

export function isRadioQueueTransitionActive(): boolean {
  return queueTransitionDepth > 0;
}

export function requestRadioInfiniteRefill(): void {
  if (isRadioQueueTransitionActive()) return;
  refillHandler?.();
}
