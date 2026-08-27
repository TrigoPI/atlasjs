import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";

import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

describe("GameplayPlugin — time wiring", () => {
  it("wires the TimeScaleManager to the engine's real TimeControl at install", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const time: TimeControl = harness.services.get(TIME);

    time.scale = 0.4;
    expect(manager.globalScale).toBe(0.4);

    manager.globalScale = 0.1;
    expect(time.scale).toBe(0.1);
  });
});
