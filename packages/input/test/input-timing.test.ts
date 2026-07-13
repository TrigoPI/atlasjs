import { describe, expect, it } from "vitest";

import { Scheduler, StepContext } from "@atlasjs/core";

import { BackendInput } from "../src/private";
import { Key } from "../src/public";

const CTX: StepContext = { dt: 1 / 60, alpha: 1, tick: 0, frame: 0, elapsed: 0 };

describe("Input — edge clear timing", () => {
  it("keeps just-pressed edges observable for the whole frame, then clears", () => {
    const scheduler = new Scheduler();
    const input = new BackendInput();
    const seen: boolean[] = [];

    // A consumer reads the edge during the frame (Logic stage)...
    scheduler.update.add(() => seen.push(input.isPressed(Key.A)), {
      name: "consumer",
      stage: "Logic",
    });
    // ...and input is reset only at the end of the frame (Late stage).
    scheduler.update.add(() => input.endFrame(), {
      name: "input:end-frame",
      stage: "Late",
    });

    // The key goes down between frames (as a DOM event would).
    input.keys.setDown(Key.A);

    // Frame 1: the consumer MUST observe the press — the whole point of the fix.
    scheduler.runLane("update", CTX);
    expect(seen).toEqual([true]);

    // Frame 2: the edge was cleared at the end of frame 1, so it is gone now.
    scheduler.runLane("update", CTX);
    expect(seen).toEqual([true, false]);

    // The key is still held: endFrame clears edges, not the down state.
    expect(input.isDown(Key.A)).toBe(true);
  });
});
