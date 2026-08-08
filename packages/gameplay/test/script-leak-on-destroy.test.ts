import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Probe extends AtlasScript {
  public updates: number = 0;
  public destroyCount: number = 0;

  public onUpdate(): void {
    this.updates++;
  }

  public onDestroy(): void {
    this.destroyCount++;
  }
}

describe("script cleanup on non-GameEntity destroy", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("runs onDestroy once, GCs the record, and stops updates when destroyed via world.commands.destroy", () => {
    const e: Entity = h.world.createEntity();
    const probe: Probe = h.scripts.attach(e, Probe);

    h.frame();
    expect(probe.updates).toBeGreaterThan(0);
    expect(probe.destroyCount).toBe(0);

    h.world.commands.destroy(e);
    h.frame();
    h.frame();

    expect(probe.destroyCount).toBe(1);
    expect(h.scripts.getScriptsByEntity(e)).toHaveLength(0);

    const settled: number = probe.updates;
    h.frame();
    h.frame();
    h.frame();
    expect(probe.updates).toBe(settled);
  });
});
