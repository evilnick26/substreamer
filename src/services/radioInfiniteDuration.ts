/** Issue #95: configurable Radio Infinite track duration policy. */

export const DEFAULT_RADIO_MIN_DURATION = 90;
export const DEFAULT_RADIO_MAX_DURATION = 480;

export const RADIO_MIN_DURATION_OPTIONS = [
  0, 15, 30, 45, 60, 90, 120, 150, 180, 240, 300,
] as const;

export const RADIO_MAX_DURATION_OPTIONS = [
  120, 180, 240, 300, 360, 420, 480,
  540, 600, 720, 900, 1200, 1800, 3600, null,
] as const;

export interface RadioDurationPolicy {
  minDuration: number;
  maxDuration: number | null;
}

export const DEFAULT_RADIO_DURATION_POLICY: Readonly<RadioDurationPolicy> = {
  minDuration: DEFAULT_RADIO_MIN_DURATION,
  maxDuration: DEFAULT_RADIO_MAX_DURATION,
};

/** Validate both boundaries without silently changing either value. */
export function isValidRadioDurationPolicy(
  minDuration: unknown,
  maxDuration: unknown,
): boolean {
  if (
    typeof minDuration !== 'number' ||
    !Number.isSafeInteger(minDuration) ||
    minDuration < 0
  ) {
    return false;
  }

  if (maxDuration === null) return true;

  return (
    typeof maxDuration === 'number' &&
    Number.isSafeInteger(maxDuration) &&
    maxDuration > 0 &&
    maxDuration >= minDuration
  );
}

/** Unknown or invalid track durations remain ineligible without limits. */
export function isRadioDurationEligible(
  duration: number | undefined,
  policy: Readonly<RadioDurationPolicy>,
): boolean {
  return (
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration > 0 &&
    duration >= policy.minDuration &&
    (policy.maxDuration === null || duration <= policy.maxDuration)
  );
}
