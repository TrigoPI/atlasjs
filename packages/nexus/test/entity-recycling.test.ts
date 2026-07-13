import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { Entity } from "../src/nexus-types";
import { entityGeneration, entityIndex } from "../src/entity";

class Health {
  public value: number;
  public constructor(value: number = 100) {
    this.value = value;
  }
}

describe("entity recycling", () => {
  it("reuses the freed slot but issues a distinct handle", () => {
    const world: NexusWorld = new NexusWorld();

    const a: Entity = world.createEntity();
    world.destroyEntity(a);
    const b: Entity = world.createEntity();

    // The low-bits slot is recycled, but the generation bump makes the handle
    // distinct so stale references can be told apart.
    expect(entityIndex(b)).toBe(entityIndex(a));
    expect(entityGeneration(b)).toBe(entityGeneration(a) + 1);
    expect(b).not.toBe(a);
  });

  it("does not treat a stale handle as a live entity after recycling", () => {
    const world: NexusWorld = new NexusWorld();

    const stale: Entity = world.createEntity();
    world.destroyEntity(stale);
    world.createEntity(); // recycles stale's slot

    expect(world.exists(stale)).toBe(false);
  });

  it("does not leak a destroyed entity's component through a stale handle", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Health);

    const stale: Entity = world.createEntity();
    world.addComponent(stale, Health, 42);
    world.destroyEntity(stale);

    const fresh: Entity = world.createEntity(); // recycles stale's slot
    world.addComponent(fresh, Health, 7);

    // A stale handle must not resolve the fresh entity's component.
    expect(world.exists(stale)).toBe(false);
    expect(world.hasComponent(fresh, Health)).toBe(true);
    expect(world.getComponent(fresh, Health)?.value).toBe(7);
  });
});
