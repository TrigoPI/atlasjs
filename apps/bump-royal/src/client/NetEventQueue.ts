import type { ServerEvent } from "../net/protocol";

/* 32 buffered snapshots is what SnapshotBuffer keeps; 16 events each is far above what the
   simulation can produce over that span. The cap only stops a starved render clock from growing
   the array without bound. */
export const MAX_PENDING_EVENTS: number = 512;

/* Events must not fire when their snapshot arrives. The snapshot is RENDER_DELAY_TICKS ahead of
   what is on screen, so a bump applied on arrival squishes both discs a tenth of a second before
   they visibly touch. They are held here and released when the render clock reaches them. */
export class NetEventQueue {
  private readonly pending: ServerEvent[];

  public constructor() {
    this.pending = [];
  }

  public get size(): number {
    return this.pending.length;
  }

  public peek(): ServerEvent | null {
    return this.pending.length === 0 ? null : this.pending[0];
  }

  /* Appended, never sorted: the server stamps in tick order and WebSocket delivery is ordered,
     so arrival order is tick order. */
  public push(events: readonly ServerEvent[]): void {
    for (const event of events) {
      this.pending.push(event);
    }

    while (this.pending.length > MAX_PENDING_EVENTS) {
      this.pending.shift();
    }
  }

  public drain(renderTick: number, apply: (event: ServerEvent) => void): void {
    while (this.pending.length > 0 && this.pending[0].t <= renderTick) {
      const event: ServerEvent = this.pending[0];
      this.pending.shift();
      apply(event);
    }
  }

  public clear(): void {
    this.pending.length = 0;
  }
}
