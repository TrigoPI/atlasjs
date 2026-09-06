import type { InputFrame, NetId } from "../net/protocol";

/* One client frame of input is produced at 60 Hz and consumed at 60 Hz, so the queue is
   normally one or two frames deep. The cap only bounds a client whose clock runs fast or that
   is deliberately flooding; it is several ticks of slack, not a jitter buffer. */
export const MAX_BUFFERED_FRAMES: number = 8;

export const NO_INPUT_TICK: number = -1;

export type ConsumedInput = {
  readonly x: number;
  readonly y: number;
  readonly dash: boolean;
};

type Slot = {
  queue: InputFrame[];
  highestReceivedTick: number;
  lastConsumedTick: number;
  heldX: number;
  heldY: number;
};

const NEUTRAL: ConsumedInput = { x: 0, y: 0, dash: false };

function createSlot(): Slot {
  return {
    queue: [],
    highestReceivedTick: NO_INPUT_TICK,
    lastConsumedTick: NO_INPUT_TICK,
    heldX: 0,
    heldY: 0,
  };
}

function byTick(a: InputFrame, b: InputFrame): number {
  return a.t - b.t;
}

export class InputInbox {
  private readonly slots: Map<NetId, Slot>;

  public constructor() {
    this.slots = new Map<NetId, Slot>();
  }

  public add(id: NetId, frames: readonly InputFrame[]): void {
    if (frames.length === 0) {
      return;
    }

    const slot: Slot = this.slotFor(id);

    /* Every client frame re-sends the last INPUT_REDUNDANCY frames, so most of what arrives
       here has already been queued. The watermark drops those copies whole — which is also
       what keeps one client-side dash edge from becoming INPUT_REDUNDANCY dashes. */
    const fresh: InputFrame[] = frames
      .filter(
        (frame: InputFrame): boolean => frame.t > slot.highestReceivedTick,
      )
      .sort(byTick);

    if (fresh.length === 0) {
      return;
    }

    slot.highestReceivedTick = fresh[fresh.length - 1].t;
    slot.queue.push(...fresh);

    this.trim(slot);
  }

  public consume(id: NetId): ConsumedInput {
    const slot: Slot | undefined = this.slots.get(id);

    if (slot === undefined) {
      return NEUTRAL;
    }

    const frame: InputFrame | undefined = slot.queue.shift();

    /* No frame this tick: hold the last direction and drop the dash. A late or lost packet
       under a held key must not read as "the player let go", and it must not resend an edge
       the client only ever pressed once. */
    if (frame === undefined) {
      return { x: slot.heldX, y: slot.heldY, dash: false };
    }

    slot.heldX = frame.x;
    slot.heldY = frame.y;
    slot.lastConsumedTick = frame.t;

    return { x: frame.x, y: frame.y, dash: frame.d };
  }

  public ackOf(id: NetId): number {
    return this.slots.get(id)?.lastConsumedTick ?? NO_INPUT_TICK;
  }

  public pending(id: NetId): number {
    return this.slots.get(id)?.queue.length ?? 0;
  }

  public forget(id: NetId): void {
    this.slots.delete(id);
  }

  public clear(): void {
    this.slots.clear();
  }

  private slotFor(id: NetId): Slot {
    const existing: Slot | undefined = this.slots.get(id);

    if (existing !== undefined) {
      return existing;
    }

    const slot: Slot = createSlot();
    this.slots.set(id, slot);
    return slot;
  }

  /* Dropping the oldest frame would drop its dash with it. Fold the edge into the frame that
     becomes the head instead, so an overflowing queue still fires the dash exactly once. */
  private trim(slot: Slot): void {
    while (slot.queue.length > MAX_BUFFERED_FRAMES) {
      const dropped: InputFrame = slot.queue.shift() as InputFrame;
      const head: InputFrame = slot.queue[0];

      if (dropped.d && !head.d) {
        slot.queue[0] = { t: head.t, x: head.x, y: head.y, d: true };
      }
    }
  }
}
