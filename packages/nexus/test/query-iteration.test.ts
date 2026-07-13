import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { Entity } from "../src/nexus-types";
import { Query } from "../src/query";

class Position {}
class Velocity {}
class Frozen {}

describe("query intersection", () => {
  it("yields only entities holding every requested component", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position).defineComponent(Velocity);

    const moving: Entity = world.createEntity();
    world.addComponent(moving, Position);
    world.addComponent(moving, Velocity);

    const still: Entity = world.createEntity();
    world.addComponent(still, Position);

    const query: Query = world.query(Position, Velocity);
    const result: Entity[] = [...query.entities()];

    expect(result).toEqual([moving]);
    expect(query.has(moving)).toBe(true);
    expect(query.has(still)).toBe(false);
  });

  it("returns an empty query when a requested component was never stored", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position).defineComponent(Frozen);

    const entity: Entity = world.createEntity();
    world.addComponent(entity, Position);

    const query: Query = world.query(Position, Frozen);
    expect([...query.entities()]).toEqual([]);
    expect(query.size).toBe(0);
  });

  // Phase 3 fail-fast guard: removing the base component mid-iteration used to
  // swap-remove from the dense array being walked and silently skip entities
  // (exactly what TransformWriteRequestCleanupSystem does in gameplay). The
  // guard now turns that into a loud, actionable error instead of a silent bug.
  it("throws a clear error when the base store is mutated during iteration", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Frozen);

    for (let i = 0; i < 6; i++) {
      world.addComponent(world.createEntity(), Frozen);
    }

    expect(() => {
      for (const entity of world.query(Frozen).entities()) {
        world.removeComponent(entity, Frozen);
      }
    }).toThrow(/structural change during query iteration/i);
  });

  // Phase 4 (command buffer): deferred removal must let the loop drain every
  // entity without tripping the guard. Enable once world.commands lands.
  it.todo("drains every entity when removal is deferred via world.commands");
});
