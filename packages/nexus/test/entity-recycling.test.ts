import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { Entity } from "../src/nexus-types";

class Health {
  public value: number;
  public constructor(value: number = 100) {
    this.value = value;
  }
}

describe("entity recycling", () => {
  it("reuses freed entity ids (current freelist behaviour)", () => {
    const world: NexusWorld = new NexusWorld();

    const a: Entity = world.createEntity();
    world.destroyEntity(a);
    const b: Entity = world.createEntity();

    // Documents today's behaviour: the raw id is handed straight back.
    expect(b).toBe(a);
  });

  // === Known bug — safety net for docs/nexus-ecs-redesign.md, Phase 1 ===
  // A handle to a destroyed entity must not be mistaken for the fresh entity
  // that recycled its id. Without generations, `exists` can't tell them apart.
  // Convert `it.fails` -> `it` once generations land (it will start failing here).

  it.fails(
    "does not treat a stale handle as a live entity after recycling",
    () => {
      const world: NexusWorld = new NexusWorld();

      const stale: Entity = world.createEntity();
      world.destroyEntity(stale);
      world.createEntity(); // recycles stale's id

      expect(world.exists(stale)).toBe(false);
    },
  );

  it.fails(
    "does not leak a destroyed entity's component through a stale handle",
    () => {
      const world: NexusWorld = new NexusWorld();
      world.defineComponent(Health);

      const stale: Entity = world.createEntity();
      world.addComponent(stale, Health, 42);
      world.destroyEntity(stale);

      const fresh: Entity = world.createEntity(); // recycles stale's id
      world.addComponent(fresh, Health, 7);

      // The stale handle must not read the fresh entity's component.
      expect(world.getComponent(stale, Health)?.value).not.toBe(7);
    },
  );
});
