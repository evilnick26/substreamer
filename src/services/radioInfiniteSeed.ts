export interface RadioInfiniteSeed {
  readonly primarySeedId: string;
  readonly remainingRefills: number;
}

export function isValidRadioInfiniteSeed(
  value: unknown,
): value is RadioInfiniteSeed {
  if (typeof value !== 'object' || value === null) return false;

  const seed = value as Partial<RadioInfiniteSeed>;

  return (
    typeof seed.primarySeedId === 'string' &&
    seed.primarySeedId.trim().length > 0 &&
    typeof seed.remainingRefills === 'number' &&
    Number.isInteger(seed.remainingRefills) &&
    seed.remainingRefills >= 1 &&
    seed.remainingRefills <= 5
  );
}

export function createRadioInfiniteSeed(
  primarySeedId: string,
): RadioInfiniteSeed {
  if (!primarySeedId.trim()) {
    throw new Error('Radio Infinite requires a primary seed ID.');
  }

  return {
    primarySeedId,
    remainingRefills: 3 + Math.floor(Math.random() * 3),
  };
}

export function buildRadioInfiniteSeedIds(
  seed: RadioInfiniteSeed,
  queueIds: readonly string[],
): string[] {
  return [...new Set([seed.primarySeedId, ...queueIds.slice(-2)])];
}

export function advanceRadioInfiniteSeed(
  seed: RadioInfiniteSeed,
  appendedIds: readonly string[],
): RadioInfiniteSeed {
  if (appendedIds.length === 0) return seed;

  if (seed.remainingRefills === 1) {
    return createRadioInfiniteSeed(appendedIds[0]);
  }

  return {
    ...seed,
    remainingRefills: seed.remainingRefills - 1,
  };
}

export class RadioInfiniteSeedSession {
  private seed: RadioInfiniteSeed | null = null;
  private generation = 0;

  getSnapshot(): {
    seed: RadioInfiniteSeed | null;
    generation: number;
  } {
    return {
      seed: this.seed,
      generation: this.generation,
    };
  }

  reset(primarySeedId: string): void {
    this.seed = createRadioInfiniteSeed(primarySeedId);
    this.generation += 1;
  }

  invalidate(): void {
    this.generation += 1;
  }

  clear(): void {
    this.seed = null;
    this.invalidate();
  }

  restore(value: unknown): boolean {
    if (!isValidRadioInfiniteSeed(value)) {
      this.clear();
      return false;
    }

    this.seed = {
      primarySeedId: value.primarySeedId,
      remainingRefills: value.remainingRefills,
    };
    this.generation += 1;
    return true;
  }

  completeRefill(
    generation: number,
    appendedIds: readonly string[],
  ): boolean {
    if (
      generation !== this.generation ||
      this.seed === null ||
      appendedIds.length === 0
    ) {
      return false;
    }

    this.seed = advanceRadioInfiniteSeed(this.seed, appendedIds);
    return true;
  }
}

export const radioInfiniteSeedSession = new RadioInfiniteSeedSession();
