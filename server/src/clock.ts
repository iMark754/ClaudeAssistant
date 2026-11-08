import { todayInRome } from '@gp/shared';

/** Injectable clock, so tests can freeze time. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    set(next: string) {
      current = new Date(next);
    },
  };
}

export const nowIso = (clock: Clock) => clock.now().toISOString();
export const today = (clock: Clock) => todayInRome(clock.now());
