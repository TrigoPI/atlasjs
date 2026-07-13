import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { ComponentRegistry } from "../src/ComponentRegistry";
import { Entity } from "../src/nexus-types";

class Position {
  public x: number;
  public y: number;
  public constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
}

function world(): NexusWorld {
  return new NexusWorld(new ComponentRegistry());
}

describe("hasComponent is a safe probe", () => {
  it("returns false for a never-created entity instead of throwing", () => {
    const w: NexusWorld = world();
    expect(w.hasComponent(999 as Entity, Position)).toBe(false);
  });

  it("returns false for a destroyed entity instead of throwing", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position, 1, 2);
    w.destroyEntity(entity);

    expect(() => w.hasComponent(entity, Position)).not.toThrow();
    expect(w.hasComponent(entity, Position)).toBe(false);
  });
});

describe("addComponent error message", () => {
  it("names the component, not Function, on a duplicate add", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position);

    expect(() => w.addComponent(entity, Position)).toThrow(/Position/);
  });
});

describe("addComponent accepts an existing instance", () => {
  it("attaches the very instance passed in (no reconstruction)", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();

    const instance: Position = new Position(3, 4);
    const returned: Position = w.addComponent(entity, instance);

    expect(returned).toBe(instance);
    expect(w.getComponent(entity, Position)).toBe(instance);
    expect(w.getComponent(entity, Position)?.x).toBe(3);
  });

  it("still constructs from a component + args", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();

    const created: Position = w.addComponent(entity, Position, 7, 8);

    expect(created).toBeInstanceOf(Position);
    expect(created.x).toBe(7);
    expect(created.y).toBe(8);
  });

  it("rejects a duplicate whether added by instance or constructor", () => {
    const w: NexusWorld = world();
    const entity: Entity = w.createEntity();
    w.addComponent(entity, new Position(1, 1));

    expect(() => w.addComponent(entity, Position)).toThrow(/Position/);
  });
});
