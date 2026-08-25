import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab, EntityBuilder, Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

class Marker extends AtlasScript {}

describe("prefab build failure", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("leaves no entity behind when the root build throws, and rethrows", () => {
    let rootId: Entity | null = null;

    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        rootId = entity.entity;
        entity.add(Transform2D);
        throw new Error("root boom");
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() => inst.instantiate(prefab)).toThrow("root boom");
    expect(rootId).not.toBeNull();

    h.frame();

    expect(h.world.exists(rootId!)).toBe(false);
  });

  it("leaves no entity behind when a child build throws", () => {
    let rootId: Entity | null = null;
    let siblingId: Entity | null = null;
    let failingId: Entity | null = null;

    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        rootId = entity.entity;
        entity.add(Transform2D);

        siblingId = entity.child((c: EntityBuilder): void => {
          c.add(Transform2D);
        }).entity;

        entity.child((c: EntityBuilder): void => {
          failingId = c.entity;
          c.add(Transform2D);
          throw new Error("child boom");
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() => inst.instantiate(prefab)).toThrow("child boom");
    expect(rootId).not.toBeNull();
    expect(siblingId).not.toBeNull();
    expect(failingId).not.toBeNull();

    h.frame();

    expect(h.world.exists(failingId!)).toBe(false);
    expect(h.world.exists(siblingId!)).toBe(false);
    expect(h.world.exists(rootId!)).toBe(false);
  });

  it("leaves no entity behind when a nested grandchild build throws", () => {
    let rootId: Entity | null = null;
    let childId: Entity | null = null;
    let grandchildId: Entity | null = null;

    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        rootId = entity.entity;
        entity.add(Transform2D);

        entity.child((c: EntityBuilder): void => {
          childId = c.entity;
          c.add(Transform2D);

          c.child((g: EntityBuilder): void => {
            grandchildId = g.entity;
            g.add(Transform2D);
            throw new Error("grandchild boom");
          });
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() => inst.instantiate(prefab)).toThrow("grandchild boom");

    h.frame();

    expect(h.world.exists(grandchildId!)).toBe(false);
    expect(h.world.exists(childId!)).toBe(false);
    expect(h.world.exists(rootId!)).toBe(false);
  });

  it("drops the scripts already attached to the aborted subtree", () => {
    let rootId: Entity | null = null;
    let siblingId: Entity | null = null;

    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        rootId = entity.entity;
        entity.add(Transform2D);
        entity.attach(Marker);

        siblingId = entity.child((c: EntityBuilder): void => {
          c.add(Transform2D);
          c.attach(Marker);
        }).entity;

        entity.child((c: EntityBuilder): void => {
          c.add(Transform2D);
          c.attach(Marker);
          throw new Error("child boom");
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() => inst.instantiate(prefab)).toThrow("child boom");

    expect(h.scripts.getScriptsByEntity(rootId!).length).toBe(0);
    expect(h.scripts.getScriptsByEntity(siblingId!).length).toBe(0);

    h.frame();

    expect(h.scripts.getScriptsByEntity(rootId!).length).toBe(0);
    expect(h.scripts.getScriptsByEntity(siblingId!).length).toBe(0);
  });

  it("leaves no entity behind when the requested parent is invalid", () => {
    let rootId: Entity | null = null;

    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        rootId = entity.entity;
        entity.add(Transform2D);
      },
    });

    const dead: Entity = h.world.createEntity();
    h.world.destroyEntity(dead);

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() =>
      inst.instantiate(prefab, undefined, { parent: dead }),
    ).toThrow();

    h.frame();

    expect(h.world.exists(rootId!)).toBe(false);
  });

  it("still builds the expected hierarchy when nothing throws", () => {
    const prefab = definePrefab({
      build(entity: EntityBuilder): void {
        entity.add(Transform2D);

        entity.child((first: EntityBuilder): void => {
          first.add(Transform2D);
          first.child((grand: EntityBuilder): void => {
            grand.add(Transform2D);
          });
        });

        entity.child((second: EntityBuilder): void => {
          second.add(Transform2D);
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const root: Entity = inst.instantiate(prefab).id;

    const children: ReadonlyArray<Entity> = h.world.getChildren(root);
    expect(children.length).toBe(2);
    expect(h.world.getParent(children[0])).toBe(root);
    expect(h.world.getParent(children[1])).toBe(root);

    const grandchildren: ReadonlyArray<Entity> = h.world.getChildren(
      children[0],
    );
    expect(grandchildren.length).toBe(1);
    expect(h.world.getParent(grandchildren[0])).toBe(children[0]);
    expect(h.world.getChildren(children[1]).length).toBe(0);

    h.frame();

    expect(h.world.exists(root)).toBe(true);
    expect(h.world.exists(grandchildren[0])).toBe(true);
  });
});
