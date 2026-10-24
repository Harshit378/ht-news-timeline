export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Fraction of the delay to randomize either way (0.2 → ±20%), so clients don't retry in lockstep. */
  jitter?: number;
  random?: () => number;
}

/** Delay before reconnect attempt `attempt` (0-based): base · 2^attempt, capped, with jitter. ~1, 2, 4, 8, 16 s. */
export function reconnectDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 1000, maxMs = 30_000, jitter = 0.2, random = Math.random } = options;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  const spread = exp * jitter * (random() * 2 - 1);
  return Math.round(Math.min(maxMs, Math.max(0, exp + spread)));
}
