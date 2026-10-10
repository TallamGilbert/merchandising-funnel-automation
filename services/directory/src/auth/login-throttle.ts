import { Injectable } from "@nestjs/common";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_TRACKED_IDS = 10_000;

/**
 * Locks a staff id for 15 minutes after 5 wrong passwords in a row. Kept in
 * memory: Directory runs as one instance, and a restart clearing the
 * counters is an acceptable trade for not adding a store.
 */
@Injectable()
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  /** Milliseconds until the id may try again, or 0. */
  lockedFor(staffId: string, now = Date.now()): number {
    const entry = this.failures.get(staffId);
    if (!entry || entry.lockedUntil <= now) return 0;
    return entry.lockedUntil - now;
  }

  recordFailure(staffId: string, now = Date.now()): void {
    if (this.failures.size >= MAX_TRACKED_IDS) this.prune(now);
    const entry = this.failures.get(staffId);
    const lockExpired = entry !== undefined && entry.lockedUntil !== 0 && entry.lockedUntil <= now;
    const count = !entry || lockExpired ? 1 : entry.count + 1;
    this.failures.set(staffId, {
      count,
      lockedUntil: count >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0,
    });
  }

  recordSuccess(staffId: string): void {
    this.failures.delete(staffId);
  }

  /** Failures are recorded for unknown ids too (no hint which ids exist), so keep the map bounded. */
  private prune(now: number): void {
    for (const [id, entry] of this.failures) {
      if (entry.lockedUntil <= now) this.failures.delete(id);
    }
  }
}
