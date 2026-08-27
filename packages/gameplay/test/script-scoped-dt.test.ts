import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { AtlasScript, ScriptManager } from "../src/scripting";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

class DtProbe extends AtlasScript {
  public readonly seen: number[] = [];

  public onUpdate(dt: number): void {
    this.seen.push(dt);
  }
}

describe("ScriptManager scoped dt", () => {
  it("delivers the raw dt when no scale is set", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    harness.frame();

    expect(probe.seen).toHaveLength(1);
    expect(probe.seen[0]).toBeCloseTo(0.15, 10);
  });

  it("delivers 0 to a frozen script", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0);
    harness.frame();

    expect(probe.seen).toEqual([0]);
  });

  it("still calls onUpdate on a frozen script", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0);
    harness.frame();
    harness.frame();

    expect(probe.seen.length).toBe(2);
  });

  it("a frozen subtree does not affect its sibling", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);

    const frozenRoot: Entity = harness.world.createEntity();
    const frozenChild: Entity = harness.world.createEntity();
    harness.world.setParent(frozenChild, frozenRoot);

    const free: Entity = harness.world.createEntity();

    const frozen: DtProbe = harness.scripts.attach(frozenChild, DtProbe);
    const running: DtProbe = harness.scripts.attach(free, DtProbe);

    manager.setScale(frozenRoot, 0);
    harness.frame();

    expect(frozen.seen).toEqual([0]);
    expect(running.seen).toHaveLength(1);
    expect(running.seen[0]).toBeCloseTo(0.15, 10);
  });

  it("applies a fractional scale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0.5);
    harness.frame();

    expect(probe.seen).toHaveLength(1);
    expect(probe.seen[0]).toBeCloseTo(0.075, 10);
  });

  it("falls back to an unscaled dt when no TimeScaleManager is registered", async () => {
    const harness: Harness = await createHarness();
    const bare: ServiceRegistry = new ServiceRegistry();
    const manager: ScriptManager = new ScriptManager(harness.world, bare);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0);
    const probe: DtProbe = manager.attach(entity, DtProbe);

    expect(() => manager.update(0.1)).not.toThrow();

    expect(probe.seen).toHaveLength(1);
    expect(probe.seen[0]).toBeCloseTo(0.1, 10);
  });
});
