import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { FIXED, createHarness, Harness } from "./helpers/harness";

class LaneDtProbe extends AtlasScript {
  public readonly fixedSeen: number[] = [];
  public readonly updateSeen: number[] = [];

  public onFixedUpdate(dt: number): void {
    this.fixedSeen.push(dt);
  }

  public onUpdate(dt: number): void {
    this.updateSeen.push(dt);
  }
}

describe("onFixedUpdate dt", () => {
  it("hands the engine's fixedDelta to every step of a frame", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    harness.frame(3);

    expect(probe.fixedSeen).toEqual([FIXED, FIXED, FIXED]);
  });

  it("keeps the dt a positive constant across several frames", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    harness.frame();
    harness.frame();
    harness.frame();

    expect(probe.fixedSeen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(probe.fixedSeen)).toEqual(new Set([FIXED]));
    expect(probe.fixedSeen[0]).toBeGreaterThan(0);
  });

  it("is deliberately NOT scaled by a TimeScale on the entity", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    manager.setScale(entity, 0.5);
    harness.frame(2);

    expect(probe.fixedSeen).toEqual([FIXED, FIXED]);
  });

  it("is deliberately NOT scaled by a TimeScale inherited from an ancestor", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);
    const probe: LaneDtProbe = harness.scripts.attach(child, LaneDtProbe);

    manager.setScale(root, 0.5);
    harness.frame(2);

    expect(probe.fixedSeen).toEqual([FIXED, FIXED]);
  });

  it("still delivers the raw fixedDelta to an entity frozen with a scale of 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    manager.setScale(entity, 0);
    harness.frame(2);

    expect(probe.fixedSeen).toEqual([FIXED, FIXED]);
  });

  it("diverges from onUpdate by design: fixed gets the raw dt, update the scaled one", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    manager.setScale(entity, 0.5);
    harness.frame();

    expect(probe.fixedSeen).toEqual([FIXED]);
    expect(probe.updateSeen).toHaveLength(1);
    expect(probe.updateSeen[0]).toBeCloseTo(0.075, 10);
  });

  it("lets a global time scale change how often the lane runs, never the step size", async () => {
    const harness: Harness = await createHarness();
    const time: TimeControl = harness.services.get(TIME);
    const entity: Entity = harness.world.createEntity();
    const probe: LaneDtProbe = harness.scripts.attach(entity, LaneDtProbe);

    time.scale = 0.5;
    harness.frame(4);

    expect(probe.fixedSeen).toEqual([FIXED, FIXED]);
  });
});
