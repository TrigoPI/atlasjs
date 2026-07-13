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

  // === Known bug — safety net for docs/nexus-ecs-redesign.md, Phase 3/4 ===
  // Removing the base component of a query mid-iteration swap-removes from the
  // dense array being walked, so entities get skipped (this is exactly what
  // TransformWriteRequestCleanupSystem does in gameplay). The redesign fixes it
  // via the command buffer (deferred removal) + a fail-fast iteration guard.
  // Convert `it.fails` -> `it` once that lands (it will start failing here).

  it.fails("visits every entity when removing during iteration", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Frozen);

    const entities: Entity[] = [];
    for (let i = 0; i < 6; i++) {
      const entity: Entity = world.createEntity();
      world.addComponent(entity, Frozen);
      entities.push(entity);
    }

    const visited: Entity[] = [];
    const query: Query = world.query(Frozen);
    for (const entity of query.entities()) {
      visited.push(entity);
      world.removeComponent(entity, Frozen);
    }

    expect(new Set(visited)).toEqual(new Set(entities));
    expect(world.query(Frozen).size).toBe(0);
  });
});
