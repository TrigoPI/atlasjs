import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab, Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("EntityBuilder.child", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("creates a child parented to the root", () => {
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const root: Entity = inst.instantiate(prefab).id;
    const children: ReadonlyArray<Entity> = h.world.getChildren(root);

    expect(children.length).toBe(1);
    expect(h.world.getParent(children[0])).toBe(root);
  });

  it("returns a handle whose .entity is usable to wire a sibling", () => {
    let firstChild: Entity | null = null;
    let capturedInSecond: Entity | null = null;

    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        const a = entity.child((c) => {
          c.add(Transform2D);
        });
        firstChild = a.entity;
        entity.child((c) => {
          c.add(Transform2D);
          capturedInSecond = a.entity;
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    inst.instantiate(prefab);

    expect(firstChild).not.toBeNull();
    expect(capturedInSecond).toBe(firstChild);
    expect(h.world.exists(firstChild!)).toBe(true);
  });

  it("supports nested children (arbitrary depth)", () => {
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
          c.child((g) => {
            g.add(Transform2D);
          });
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const root: Entity = inst.instantiate(prefab).id;
    const child: Entity = h.world.getChildren(root)[0];
    const grandchild: Entity = h.world.getChildren(child)[0];

    expect(h.world.getParent(child)).toBe(root);
    expect(h.world.getParent(grandchild)).toBe(child);
  });

  it("destroy on the root removes children and fires their onDestroy", () => {
    let childDestroyed: boolean = false;
    class Dying extends AtlasScript {
      public onDestroy(): void {
        childDestroyed = true;
      }
    }

    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
          c.attach(Dying);
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const gameEntity = inst.instantiate(prefab);
    const root: Entity = gameEntity.id;
    const child: Entity = h.world.getChildren(root)[0];
    h.frame();

    gameEntity.destroy();
    h.frame();

    expect(childDestroyed).toBe(true);
    expect(h.world.exists(child)).toBe(false);
    expect(h.world.exists(root)).toBe(false);
  });
});
