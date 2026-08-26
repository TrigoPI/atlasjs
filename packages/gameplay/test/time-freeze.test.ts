import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

function freezeCount(manager: TimeScaleManager): number {
  return (manager as unknown as { freezes: Map<Entity, unknown> }).freezes.size;
}

describe("TimeScaleManager.freeze", () => {
  it("sets the scale to 0 then restores it after the duration", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.1);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.15);
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("a 0.1s freeze is already over when the countdown reaches exactly 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    manager.update(0.1);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("removes the component when the entity did not carry one before", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    manager.update(0.5);

    expect(harness.world.getComponent(entity, TimeScale)).toBeUndefined();
  });

  it("restores the previous value, not 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.5);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("freezes multiple entities in the same call", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const attacker: Entity = harness.world.createEntity();
    const victim: Entity = harness.world.createEntity();

    manager.freeze(0.2, [attacker, victim]);
    manager.update(0);

    expect(manager.scaleOf(attacker)).toBe(0);
    expect(manager.scaleOf(victim)).toBe(0);
  });

  it("a second freeze extends it without memoizing 0 as the previous value", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.05);
    manager.freeze(0.3, [entity]);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("a freeze with a zero or negative duration freezes nothing", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("freeze(0) sets no TimeScale component, even transiently", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0, [entity]);

    expect(harness.world.getComponent(entity, TimeScale)).toBeUndefined();
  });

  it("setScale and clearScale set and remove the component", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.setScale(entity, 0.25);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.25);

    manager.setScale(entity, 2);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(2);

    manager.clearScale(entity);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("an entity destroyed during its freeze does not throw", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    harness.world.destroyEntity(entity);

    expect(() => manager.update(0.2)).not.toThrow();
  });

  it("freeze on an already destroyed entity does not throw", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.freeze(0.1, [entity])).not.toThrow();
  });

  it("setScale on an already destroyed entity does not throw", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.setScale(entity, 0.5)).not.toThrow();
  });

  it("clearScale on an already destroyed entity does not throw", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.clearScale(entity)).not.toThrow();
  });

  it("purges the entry of an entity destroyed during its freeze, leaving no leak in the internal table", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    harness.world.destroyEntity(entity);
    manager.update(0.2);

    expect(freezeCount(manager)).toBe(0);
  });

  it("freeze(NaN) freezes nothing", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(NaN, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("freeze with a negative duration freezes nothing", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(-0.1, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("a freeze set with no intervening beginFrame() is active immediately", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("freezing an entity that already carried a TimeScale is active without a prior update()", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("setScale on an entity with no TimeScale invalidates an already memoized value", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const memoized: Entity = harness.world.createEntity();
    const target: Entity = harness.world.createEntity();
    harness.world.addComponent(memoized, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(target)).toBe(1);

    manager.setScale(target, 0.25);

    expect(manager.scaleOf(target)).toBe(0.25);
  });

  it("a freeze invalidates an already memoized value within the same frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.5);

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("clearScale invalidates an already memoized value within the same frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.5);

    manager.clearScale(entity);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("freezing a parent also invalidates its child's already memoized scale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const parent: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, parent);
    harness.world.addComponent(parent, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(child)).toBe(0.5);

    manager.freeze(0.2, [parent]);

    expect(manager.scaleOf(child)).toBe(0);
    expect(manager.scaleOf(parent)).toBe(0);
  });

  it("a shorter freeze does not shorten a longer freeze already in progress", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.3, [entity]);
    manager.update(0.1);
    manager.freeze(0.05, [entity]);

    manager.update(0.15);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.1);
    expect(manager.scaleOf(entity)).toBe(1);
  });
});

describe("gameplay:time-scale", () => {
  it("advances the countdown once per frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(0);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("a global pause also suspends a freeze's countdown", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const time: TimeControl = harness.services.get(TIME);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    time.scale = 0;

    harness.frame();
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(0);

    time.scale = 1;
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("runs at the Early stage, before scripts at the Logic stage", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const readings: number[] = [];

    class Probe extends AtlasScript {
      public onUpdate(): void {
        readings.push(manager.scaleOf(entity));
      }
    }

    harness.scripts.attach(entity, Probe);
    manager.freeze(0.05, [entity]);

    harness.frame();

    expect(readings).toEqual([1]);
  });
});
