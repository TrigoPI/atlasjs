import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/world";
import { Entity } from "../src/types";
import { Parent, Children } from "../src/hierarchy";

describe("NexusWorld hierarchy", () => {
  it("setParent links child to parent (both sides)", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);

    expect(world.getParent(child)).toBe(parent);
    expect([...world.getChildren(parent)]).toEqual([child]);
    expect(world.getComponent(child, Parent)!.value).toBe(parent);
    expect(world.getComponent(parent, Children)!.value).toEqual([child]);
  });

  it("getChildren returns empty for a childless entity", () => {
    const world: NexusWorld = new NexusWorld();
    const e: Entity = world.createEntity();
    expect(world.getChildren(e).length).toBe(0);
  });

  it("reparenting moves the child between parents", () => {
    const world: NexusWorld = new NexusWorld();
    const a: Entity = world.createEntity();
    const b: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, a);
    world.setParent(child, b);

    expect(world.getParent(child)).toBe(b);
    expect([...world.getChildren(a)]).toEqual([]);
    expect([...world.getChildren(b)]).toEqual([child]);
  });

  it("setParent(child, null) detaches", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);
    world.setParent(child, null);

    expect(world.getParent(child)).toBeUndefined();
    expect([...world.getChildren(parent)]).toEqual([]);
  });

  it("throws on self-parenting", () => {
    const world: NexusWorld = new NexusWorld();
    const e: Entity = world.createEntity();
    expect(() => world.setParent(e, e)).toThrow();
  });

  it("throws when it would create a cycle", () => {
    const world: NexusWorld = new NexusWorld();
    const a: Entity = world.createEntity();
    const b: Entity = world.createEntity();

    world.setParent(b, a);
    expect(() => world.setParent(a, b)).toThrow();
  });

  it("destroyEntity destroys descendants recursively", () => {
    const world: NexusWorld = new NexusWorld();
    const root: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    const grandchild: Entity = world.createEntity();

    world.setParent(child, root);
    world.setParent(grandchild, child);

    world.destroyEntity(root);

    expect(world.exists(root)).toBe(false);
    expect(world.exists(child)).toBe(false);
    expect(world.exists(grandchild)).toBe(false);
  });

  it("destroying a child detaches it from its parent's Children", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);
    world.destroyEntity(child);

    expect([...world.getChildren(parent)]).toEqual([]);
  });

  it("world.commands.setParent applies on flush", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.commands.setParent(child, parent);
    expect(world.getParent(child)).toBeUndefined();

    world.flush();
    expect(world.getParent(child)).toBe(parent);
  });
});
