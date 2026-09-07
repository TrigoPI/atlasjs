import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ServerEventOutbox } from "../../src/net/EventOutbox";
import { SNAPSHOT_INTERVAL_TICKS, toNetId } from "../../src/net/protocol";
import type {
  BumpEvent,
  NetId,
  ServerEvent,
  ServerSnapshot,
} from "../../src/net/protocol";
import { registerWriteSnapshot } from "../../src/server/writeSnapshot";
import type { SnapshotSink } from "../../src/server/writeSnapshot";

import { createGameHarness } from "../helpers/engine";
import type { GameHarness } from "../helpers/engine";

const FIXED_DELTA: number = 1 / 60;

function bump(tick: number): BumpEvent {
  return {
    k: "bump",
    t: tick,
    a: toNetId(1),
    b: toNetId(2),
    px: 10,
    py: 20,
    s: 300,
  };
}

describe("writeSnapshot events", () => {
  let harness: GameHarness;
  let outbox: ServerEventOutbox;
  let sent: ServerSnapshot[];
  let recipients: NetId[];

  beforeEach(async () => {
    harness = await createGameHarness({ fixedDelta: FIXED_DELTA });
    outbox = new ServerEventOutbox();
    sent = [];
    recipients = [toNetId(1)];

    const sink: SnapshotSink = {
      recipients: (): readonly NetId[] => recipients,
      ackFor: (): number => 0,
      drainEvents: (): readonly ServerEvent[] => outbox.drain(),
      send: (_id: NetId, snapshot: ServerSnapshot): void => {
        sent.push(snapshot);
      },
    };

    registerWriteSnapshot(harness.scheduler, harness.world, sink);
  });

  afterEach(() => {
    harness.stop();
  });

  it("attaches what the outbox holds and leaves `e` off an empty snapshot", () => {
    harness.frame(SNAPSHOT_INTERVAL_TICKS);

    expect(sent).toHaveLength(1);
    expect(sent[0].e).toBeUndefined();

    outbox.push(bump(4));
    harness.frame(SNAPSHOT_INTERVAL_TICKS);

    expect(sent).toHaveLength(2);
    expect(sent[1].e).toEqual([bump(4)]);
  });

  it("empties the outbox even while nobody is connected", () => {
    recipients = [];
    outbox.push(bump(1));

    harness.frame(SNAPSHOT_INTERVAL_TICKS);

    expect(sent).toEqual([]);
    expect(outbox.size).toBe(0);

    /* Without the drain above, the first client to connect would inherit every bump the room
       produced while it was empty and play them all in one frame. */
    recipients = [toNetId(1)];
    harness.frame(SNAPSHOT_INTERVAL_TICKS);

    expect(sent).toHaveLength(1);
    expect(sent[0].e).toBeUndefined();
  });
});
