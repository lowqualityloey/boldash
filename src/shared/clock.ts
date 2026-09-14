/**
 * Time is injected, never called directly by engines
 * (AGENTS.md §Test conventions: "Do not mock the clock. Inject time").
 */
export interface Clock {
  /** Current time as ISO-8601 UTC (the state schemas' pattern). */
  nowIso(): string;
  /** Monotonic-ish epoch millis for lease TTLs and latency math. */
  nowEpochMs(): number;
}

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowEpochMs: () => Date.now(),
};

/** Deterministic clock for tests; advance() is the only way time moves. */
export class FixedClock implements Clock {
  private at: Date;
  constructor(iso = '2026-01-01T00:00:00.000Z') {
    this.at = new Date(iso);
  }
  nowIso(): string {
    return this.at.toISOString();
  }
  nowEpochMs(): number {
    return this.at.getTime();
  }
  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms);
  }
}
