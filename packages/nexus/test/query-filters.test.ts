import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { ComponentRegistry } from "../src/ComponentRegistry";
import { Entity } from "../src/nexus-types";

class Position {
  public x: number;
  public constructor(x: number = 0) {
    this.x = x;
  }
}

class Velocity {
  public dx: number;
  public constructor(dx: number = 0) {
    this.dx = dx;
  }
}

class Frozen {}

function world(): NexusWorld {
  return new NexusWorld(new ComponentRegistry());
}

describe("query.without (exclusion)", () => {
  it("excludes entities carrying the forbidden component", () => {
    const w: NexusWorld = world();

    const free: Entity = w.createEntity();
    w.addComponent(free, Position, 1);

    const frozen: Entity = w.createEntity();
    w.addComponent(frozen, Position, 2);
    w.addComponent(frozen, Frozen);

    const result: Entity[] = [...w.query(Position).without(Frozen).entities()];

    expect(result).toEqual([free]);
  });

  it("is a no-op when the excluded component was never used", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position, 1);

    expect(w.query(Position).without(Frozen).size).toBe(1);
  });

  it("works through each() and preserves the component tuple", () => {
    const w: NexusWorld = world();

    const kept: Entity = w.createEntity();
    w.addComponent(kept, Position, 9);

    const skipped: Entity = w.createEntity();
    w.addComponent(skipped, Position, 8);
    w.addComponent(skipped, Frozen);

    const seen: Array<[Entity, number]> = [];
    w.query(Position)
      .without(Frozen)
      .each((entity, position) => seen.push([entity, position.x]));

    expect(seen).toEqual([[kept, 9]]);
  });
});

describe("query.optional", () => {
  it("yields the optional component when present and undefined when absent", () => {
    const w: NexusWorld = world();

    const withVel: Entity = w.createEntity();
    w.addComponent(withVel, Position, 1);
    w.addComponent(withVel, Velocity, 5);

    const withoutVel: Entity = w.createEntity();
    w.addComponent(withoutVel, Position, 2);

    const seen: Array<[Entity, number, number | undefined]> = [];
    w.query(Position)
      .optional(Velocity)
      .each((entity, position, velocity) => {
        seen.push([entity, position.x, velocity?.dx]);
      });

    expect(seen).toContainEqual([withVel, 1, 5]);
    expect(seen).toContainEqual([withoutVel, 2, undefined]);
    expect(seen).toHaveLength(2);
  });

  it("does not filter membership on the optional component", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position, 1);

    // Position-only entity still appears even though Velocity is requested.
    expect(w.query(Position).optional(Velocity).size).toBe(1);
  });

  it("combines with without", () => {
    const w: NexusWorld = world();

    const a: Entity = w.createEntity();
    w.addComponent(a, Position, 1);
    w.addComponent(a, Velocity, 7);

    const frozen: Entity = w.createEntity();
    w.addComponent(frozen, Position, 2);
    w.addComponent(frozen, Frozen);

    const seen: Array<[Entity, number | undefined]> = [];
    w.query(Position)
      .without(Frozen)
      .optional(Velocity)
      .each((entity, _position, velocity) => {
        seen.push([entity, velocity?.dx]);
      });

    expect(seen).toEqual([[a, 7]]);
  });
});
