import { SNAPSHOT_INTERVAL_TICKS, TICK_HZ } from "./protocol";
import type { ServerSnapshot } from "./protocol";

/* Six ticks, 100 ms: one snapshot interval so a sample ahead of the render clock always
   exists, one more as jitter slack. */
export const RENDER_DELAY_TICKS: number = 2 * SNAPSHOT_INTERVAL_TICKS;

/* 1.6 s of history at 20 Hz. Nothing reads that far back; the cap only stops a starved render
   clock from growing the array without bound. */
export const MAX_BUFFERED_SNAPSHOTS: number = 32;

export type SnapshotBracket = {
  readonly from: ServerSnapshot;
  readonly to: ServerSnapshot | null;
};

/* Time is in seconds and supplied by the caller; the buffer never reads a clock itself, which
   is what keeps it testable with no browser and no socket. */
export class SnapshotBuffer {
  private readonly snapshots: ServerSnapshot[];

  private baseTick: number;
  private baseTime: number;
  private anchored: boolean;

  public constructor() {
    this.snapshots = [];
    this.baseTick = 0;
    this.baseTime = 0;
    this.anchored = false;
  }

  public get size(): number {
    return this.snapshots.length;
  }

  public get hasAnchor(): boolean {
    return this.anchored;
  }

  public newest(): ServerSnapshot | null {
    const count: number = this.snapshots.length;
    return count === 0 ? null : this.snapshots[count - 1];
  }

  public oldest(): ServerSnapshot | null {
    return this.snapshots.length === 0 ? null : this.snapshots[0];
  }

  public anchor(tick: number, now: number): void {
    this.baseTick = tick;
    this.baseTime = now;
    this.anchored = true;
  }

  /* WebSocket delivery is ordered, so a snapshot that is not newer than the newest held can
     only be a duplicate; dropping it keeps the array sorted for bracket(). */
  public push(snapshot: ServerSnapshot, now: number): boolean {
    const newest: ServerSnapshot | null = this.newest();

    if (newest !== null && snapshot.t <= newest.t) {
      return false;
    }

    if (!this.anchored) {
      this.anchor(snapshot.t, now);
    }

    this.snapshots.push(snapshot);

    while (this.snapshots.length > MAX_BUFFERED_SNAPSHOTS) {
      this.snapshots.shift();
    }

    return true;
  }

  public serverTick(now: number): number {
    return this.baseTick + (now - this.baseTime) * TICK_HZ;
  }

  public renderTick(now: number): number {
    return this.serverTick(now) - RENDER_DELAY_TICKS;
  }

  public bracket(tick: number): SnapshotBracket | null {
    const count: number = this.snapshots.length;

    if (count === 0) {
      return null;
    }

    for (let i: number = count - 1; i >= 0; i--) {
      const candidate: ServerSnapshot = this.snapshots[i];

      if (candidate.t <= tick) {
        return {
          from: candidate,
          to: i + 1 < count ? this.snapshots[i + 1] : null,
        };
      }
    }

    return { from: this.snapshots[0], to: null };
  }

  /* A backgrounded tab throttles its frame loop to roughly 1 Hz while snapshots keep arriving,
     so the buffer ends up holding seconds of history the render clock never walked through.
     Replaying it on return would rewind the game; dropping everything but the newest sample
     and re-anchoring the clock on it costs one jump instead. */
  public resync(now: number): void {
    const newest: ServerSnapshot | null = this.newest();

    if (newest === null) {
      return;
    }

    this.snapshots.length = 0;
    this.snapshots.push(newest);
    this.anchor(newest.t, now);
  }

  public clear(): void {
    this.snapshots.length = 0;
    this.anchored = false;
  }
}
