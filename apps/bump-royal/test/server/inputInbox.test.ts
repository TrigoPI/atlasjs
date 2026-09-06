import { describe, expect, it } from "vitest";

import { INPUT_REDUNDANCY, toNetId } from "../../src/net/protocol";
import type { InputFrame, NetId } from "../../src/net/protocol";

import {
  InputInbox,
  MAX_BUFFERED_FRAMES,
  NO_INPUT_TICK,
} from "../../src/server/InputInbox";
import type { ConsumedInput } from "../../src/server/InputInbox";

const PLAYER: NetId = toNetId(1);
const OVERFLOW_FRAMES: number = MAX_BUFFERED_FRAMES + 4;

function frame(t: number, x: -1 | 0 | 1, dash: boolean = false): InputFrame {
  return { t, x, y: 0, d: dash };
}

function drain(inbox: InputInbox, ticks: number): ConsumedInput[] {
  const consumed: ConsumedInput[] = [];

  for (let i: number = 0; i < ticks; i++) {
    consumed.push(inbox.consume(PLAYER));
  }

  return consumed;
}

function dashCount(consumed: readonly ConsumedInput[]): number {
  return consumed.filter((input: ConsumedInput): boolean => input.dash).length;
}

describe("InputInbox", () => {
  it("queues a frame once however many redundant copies arrive", () => {
    const inbox: InputInbox = new InputInbox();
    const window: InputFrame[] = [frame(0, 1), frame(1, 1), frame(2, 1)];

    for (let copy: number = 0; copy < INPUT_REDUNDANCY; copy++) {
      inbox.add(PLAYER, window);
    }

    expect(inbox.pending(PLAYER)).toBe(window.length);
  });

  it("keeps only the frames it has not already seen from an overlapping window", () => {
    const inbox: InputInbox = new InputInbox();

    inbox.add(PLAYER, [frame(0, 1), frame(1, 1), frame(2, 1)]);
    inbox.add(PLAYER, [frame(1, 1), frame(2, 1), frame(3, 1)]);

    expect(inbox.pending(PLAYER)).toBe(4);
  });

  it("holds the last direction and drops the dash when a tick has no frame", () => {
    const inbox: InputInbox = new InputInbox();

    inbox.add(PLAYER, [frame(0, 1, true)]);

    const consumed: ConsumedInput[] = drain(inbox, 3);

    expect(consumed[0]).toEqual({ x: 1, y: 0, dash: true });
    expect(consumed[1]).toEqual({ x: 1, y: 0, dash: false });
    expect(consumed[2]).toEqual({ x: 1, y: 0, dash: false });
  });

  it("turns one client dash edge into exactly one dash tick", () => {
    const inbox: InputInbox = new InputInbox();
    const edge: InputFrame = frame(7, 0, true);

    for (let copy: number = 0; copy < INPUT_REDUNDANCY; copy++) {
      inbox.add(PLAYER, [edge]);
    }

    expect(dashCount(drain(inbox, 10))).toBe(1);
  });

  it("still fires the dash exactly once when the queue overflows", () => {
    const inbox: InputInbox = new InputInbox();

    for (let i: number = 0; i < OVERFLOW_FRAMES; i++) {
      inbox.add(PLAYER, [frame(i, 1, i === 0)]);
    }

    expect(inbox.pending(PLAYER)).toBe(MAX_BUFFERED_FRAMES);
    expect(dashCount(drain(inbox, OVERFLOW_FRAMES))).toBe(1);
  });

  it("acks the last input tick the simulation consumed", () => {
    const inbox: InputInbox = new InputInbox();

    expect(inbox.ackOf(PLAYER)).toBe(NO_INPUT_TICK);

    inbox.add(PLAYER, [frame(10, 1), frame(11, 1)]);
    inbox.consume(PLAYER);
    expect(inbox.ackOf(PLAYER)).toBe(10);

    inbox.consume(PLAYER);
    expect(inbox.ackOf(PLAYER)).toBe(11);

    inbox.consume(PLAYER);
    expect(inbox.ackOf(PLAYER)).toBe(11);
  });

  it("reports a neutral intent for an id it has never heard from", () => {
    const inbox: InputInbox = new InputInbox();

    expect(inbox.consume(toNetId(42))).toEqual({ x: 0, y: 0, dash: false });
    expect(inbox.ackOf(toNetId(42))).toBe(NO_INPUT_TICK);
  });

  it("forgets a player so a recycled slot cannot inherit its input", () => {
    const inbox: InputInbox = new InputInbox();

    inbox.add(PLAYER, [frame(0, 1)]);
    inbox.forget(PLAYER);

    expect(inbox.pending(PLAYER)).toBe(0);
    expect(inbox.consume(PLAYER)).toEqual({ x: 0, y: 0, dash: false });
  });
});
