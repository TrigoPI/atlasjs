import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { Entity } from "../src/nexus-types";

class Position {
  public x: number;
  public y: number;
  public constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
}

class Velocity {
  public dx: number;
  public constructor(dx: number = 0) {
    this.dx = dx;
  }
}

class Tag {}

function seed(): {
  world: NexusWorld;
  moving: Entity;
  still: Entity;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Position).defineComponent(Velocity).defineComponent(Tag);

  const moving: Entity = world.createEntity();
  world.addComponent(moving, Position, 1, 2);
  world.addComponent(moving, Velocity, 5);

  const still: Entity = world.createEntity();
  world.addComponent(still, Position, 9, 9);

  return { world, moving, still };
}

describe("typed query iteration", () => {
  it("each() hands the resolved components for matching entities only", () => {
    const { world, moving } = seed();

    const seen: Array<[Entity, number, number]> = [];
    world.query(Position, Velocity).each((entity, position, velocity) => {
      seen.push([entity, position.x, velocity.dx]);
    });

    expect(seen).toEqual([[moving, 1, 5]]);
  });

  it("each() lets systems mutate component data in place", () => {
    const { world, moving } = seed();

    world.query(Position, Velocity).each((_, position, velocity) => {
      position.x += velocity.dx;
    });

    expect(world.getComponent(moving, Position)?.x).toBe(6);
  });

  it("supports for...of destructuring of [entity, ...components]", () => {
    const { world, moving } = seed();

    const seen: Entity[] = [];
    for (const [entity, position, velocity] of world.query(
      Position,
      Velocity,
    )) {
      seen.push(entity);
      expect(position.x).toBe(1);
      expect(velocity.dx).toBe(5);
    }

    expect(seen).toEqual([moving]);
  });

  it("iterates from the smallest store but resolves components in requested order", () => {
    const { world, moving } = seed();

    // Velocity (1 entity) is smaller than Position (2): it becomes the base,
    // but the callback args must still follow the (Position, Velocity) order.
    let calls: number = 0;
    world.query(Position, Velocity).each((entity, position, velocity) => {
      calls++;
      expect(entity).toBe(moving);
      expect(position).toBeInstanceOf(Position);
      expect(velocity).toBeInstanceOf(Velocity);
    });

    expect(calls).toBe(1);
  });
});
