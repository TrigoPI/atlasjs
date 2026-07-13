import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { Entity } from "../src/nexus-types";

class Position {
  public x: number;
  public constructor(x: number = 0) {
    this.x = x;
  }
}

class Frozen {}

describe("command buffer", () => {
  it("spawns entities immediately (safe mid-iteration)", () => {
    const world: NexusWorld = new NexusWorld();

    const entity: Entity = world.commands.spawn();

    expect(world.exists(entity)).toBe(true);
  });

  it("defers add until flush", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position);

    const entity: Entity = world.createEntity();
    world.commands.add(entity, Position, 42);

    expect(world.hasComponent(entity, Position)).toBe(false);

    world.flush();

    expect(world.hasComponent(entity, Position)).toBe(true);
    expect(world.getComponent(entity, Position)?.x).toBe(42);
  });

  it("defers remove and destroy until flush", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position).defineComponent(Frozen);

    const kept: Entity = world.createEntity();
    world.addComponent(kept, Position, 1);
    world.addComponent(kept, Frozen);

    const doomed: Entity = world.createEntity();
    world.addComponent(doomed, Position, 2);

    world.commands.remove(kept, Frozen);
    world.commands.destroy(doomed);

    // Nothing applied yet.
    expect(world.hasComponent(kept, Frozen)).toBe(true);
    expect(world.exists(doomed)).toBe(true);

    world.flush();

    expect(world.hasComponent(kept, Frozen)).toBe(false);
    expect(world.hasComponent(kept, Position)).toBe(true);
    expect(world.exists(doomed)).toBe(false);
  });

  it("applies commands in registration order", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position);

    const entity: Entity = world.createEntity();
    world.commands.add(entity, Position, 1);
    world.commands.set(entity, Position, 2);
    world.commands.set(entity, Position, 3);

    world.flush();

    expect(world.getComponent(entity, Position)?.x).toBe(3);
  });

  it("tolerates a double destroy in the same flush", () => {
    const world: NexusWorld = new NexusWorld();

    const entity: Entity = world.createEntity();
    world.commands.destroy(entity);
    world.commands.destroy(entity);

    expect(() => world.flush()).not.toThrow();
    expect(world.exists(entity)).toBe(false);
  });

  it("empties the queue after flush", () => {
    const world: NexusWorld = new NexusWorld();
    world.defineComponent(Position);

    const entity: Entity = world.createEntity();
    world.commands.add(entity, Position, 1);
    world.flush();

    world.removeComponent(entity, Position);
    world.flush(); // replaying must not re-add

    expect(world.hasComponent(entity, Position)).toBe(false);
  });
});
