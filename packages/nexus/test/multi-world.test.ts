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

describe("ComponentRegistry", () => {
  it("assigns a stable id per component and reuses it", () => {
    const registry: ComponentRegistry = new ComponentRegistry();

    const first: number = registry.register(Position);
    const second: number = registry.register(Position);

    expect(first).toBe(second);
    expect(registry.get(Position)).toBe(first);
    expect(registry.has(Position)).toBe(true);
  });

  it("reports unknown components without registering them", () => {
    const registry: ComponentRegistry = new ComponentRegistry();

    expect(registry.has(Position)).toBe(false);
    expect(registry.get(Position)).toBeUndefined();
    expect(registry.size).toBe(0);
  });
});

describe("multi-world isolation", () => {
  it("keeps entities and components independent across worlds", () => {
    const a: NexusWorld = new NexusWorld();
    const b: NexusWorld = new NexusWorld();

    const ea: Entity = a.createEntity();
    a.addComponent(ea, Position, 1);

    // Same raw id space, but the worlds must not see each other's entities.
    expect(b.exists(ea)).toBe(false);

    const eb: Entity = b.createEntity();
    b.addComponent(eb, Position, 2);

    expect(a.getComponent(ea, Position)?.x).toBe(1);
    expect(b.getComponent(eb, Position)?.x).toBe(2);
    expect(a.query(Position).size).toBe(1);
    expect(b.query(Position).size).toBe(1);
  });

  it("shares stable component ids across worlds via the default registry", () => {
    // Two default-registry worlds resolve the same component to the same store
    // key, yet each keeps its own store instance.
    const a: NexusWorld = new NexusWorld();
    const b: NexusWorld = new NexusWorld();

    const ea: Entity = a.createEntity();
    a.addComponent(ea, Position, 10);
    const eb: Entity = b.createEntity();
    b.addComponent(eb, Position, 20);

    expect(a.getComponent(ea, Position)?.x).toBe(10);
    expect(b.getComponent(eb, Position)?.x).toBe(20);
  });

  it("supports an injected registry for full id isolation", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());

    const entity: Entity = world.createEntity();
    world.addComponent(entity, Position, 5);

    expect(world.getComponent(entity, Position)?.x).toBe(5);
  });
});

describe("auto-define", () => {
  it("registers a component on first use without an explicit defineComponent", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());

    const entity: Entity = world.createEntity();
    // No world.defineComponent(Position) call — must not throw anymore.
    expect(() => world.addComponent(entity, Position, 7)).not.toThrow();
    expect(world.getComponent(entity, Position)?.x).toBe(7);
  });

  it("treats an unused component as simply absent (no throw)", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());

    const entity: Entity = world.createEntity();

    expect(world.hasComponent(entity, Position)).toBe(false);
    expect(world.getComponent(entity, Position)).toBeUndefined();
    expect(world.query(Position).size).toBe(0);
  });
});
