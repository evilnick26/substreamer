type RadioInfiniteRefillHandler = () => void;

let refillHandler: RadioInfiniteRefillHandler | null = null;

export function registerRadioInfiniteRefillHandler(
  handler: RadioInfiniteRefillHandler,
): void {
  refillHandler = handler;
}

let queueRevision = 0;
let queueTransitionDepth = 0;

export function getRadioQueueRevision(): number {
  return queueRevision;
}

export function beginRadioQueueTransition(): void {
  queueRevision += 1;
  queueTransitionDepth += 1;
}

export function endRadioQueueTransition(): void {
  queueTransitionDepth = Math.max(0, queueTransitionDepth - 1);
}

export function isRadioQueueTransitionActive(): boolean {
  return queueTransitionDepth > 0;
}

let nativeQueueUncertain = false;

export function markRadioQueueUncertain(): void {
  nativeQueueUncertain = true;
}

export function markRadioQueueSynchronized(): void {
  nativeQueueUncertain = false;
}

let queueMutationDepth = 0;

export function beginRadioQueueMutation(): void {
  queueRevision += 1;
  queueMutationDepth += 1;
}

export function endRadioQueueMutation(): void {
  if (queueMutationDepth === 0) return;

  queueMutationDepth -= 1;

  if (queueMutationDepth === 0) {
    requestRadioInfiniteRefill();
  }
}

export function canRefillRadioInfinite(): boolean {
  return (
    !isRadioQueueTransitionActive() &&
    queueMutationDepth === 0 &&
    !nativeQueueUncertain
  );
}

export function requestRadioInfiniteRefill(): void {
  if (!canRefillRadioInfinite()) return;
  refillHandler?.();
}

let activeRadioAppend: Promise<void> | null = null;

export async function waitForRadioAppend(): Promise<void> {
  if (activeRadioAppend) {
    await activeRadioAppend;
  }
}

export async function runRadioAppend<T>(
  operation: () => Promise<T>,
): Promise<T | undefined> {
  if (!canRefillRadioInfinite() || activeRadioAppend) {
    return undefined;
  }

  let release!: () => void;

  activeRadioAppend = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    return await operation();
  } finally {
    activeRadioAppend = null;
    release();
  }
}
