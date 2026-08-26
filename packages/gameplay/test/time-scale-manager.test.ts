import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeScaleManager.scaleOf", () => {
  it("returns 1 for an entity with no TimeScale anywhere", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("applies the scale carried by the entity itself", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("inherits the scale from an ancestor", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    const grandChild: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.setParent(grandChild, child);
    harness.world.addComponent(root, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(grandChild)).toBe(0);
  });

  it("multiplies nested scales", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.addComponent(root, TimeScale, 0.5);
    harness.world.addComponent(child, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(child)).toBe(0.25);
  });

  it("leaves a sibling subtree at 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const frozen: Entity = harness.world.createEntity();
    const other: Entity = harness.world.createEntity();

    harness.world.addComponent(frozen, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(frozen)).toBe(0);
    expect(manager.scaleOf(other)).toBe(1);
  });

  it("clamps a negative value to 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, -3);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("walks no parent when the world carries no TimeScale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);

    let parentLookups: number = 0;
    const realGetParent = harness.world.getParent.bind(harness.world);
    harness.world.getParent = (entity: Entity): Entity | undefined => {
      parentLookups += 1;
      return realGetParent(entity);
    };

    manager.beginFrame();
    manager.scaleOf(child);

    expect(parentLookups).toBe(0);
  });

  it("picks up a TimeScale added after the previous frame's beginFrame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();
    expect(manager.scaleOf(entity)).toBe(1);

    harness.world.addComponent(entity, TimeScale, 0);
    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("invalidates the memo across frames when the value changes", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const scale: TimeScale = harness.world.addComponent(entity, TimeScale, 0.5);

    manager.beginFrame();
    expect(manager.scaleOf(entity)).toBe(0.5);

    scale.value = 1;
    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("returns 1 for a destroyed entity when the world carries a TimeScale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const scaled: Entity = harness.world.createEntity();
    harness.world.addComponent(scaled, TimeScale, 0.5);
    const destroyed: Entity = harness.world.createEntity();
    harness.world.destroyEntity(destroyed);

    manager.beginFrame();

    expect(manager.scaleOf(destroyed)).toBe(1);
  });
});

describe("TimeScale", () => {
  it("defaults to 1", () => {
    expect(new TimeScale().value).toBe(1);
  });

  it("clamps a negative value assigned through the setter to 0", () => {
    const scale: TimeScale = new TimeScale(1);

    scale.value = -1;

    expect(scale.value).toBe(0);
  });

  it("clamps NaN to 0 in the constructor", () => {
    expect(new TimeScale(NaN).value).toBe(0);
  });

  it("clamps NaN to 0 through the setter", () => {
    const scale: TimeScale = new TimeScale(1);

    scale.value = NaN;

    expect(scale.value).toBe(0);
  });
});
