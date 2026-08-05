import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript, createGameEntity } from "../src/scripting";
import { Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("GameEntity.destroy / Instantiator.destroy", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("removes the entity after a frame", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    createGameEntity(e, h.world, h.scripts).destroy();
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });

  it("fires onDestroy of the entity's scripts", () => {
    let destroyed: boolean = false;
    class Dying extends AtlasScript {
      public onDestroy(): void {
        destroyed = true;
      }
    }

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Dying);
    h.frame();

    createGameEntity(e, h.world, h.scripts).destroy();
    h.frame();

    expect(destroyed).toBe(true);
  });

  it("recurses into children entities and their scripts", () => {
    let childDestroyed: boolean = false;
    class ChildScript extends AtlasScript {
      public onDestroy(): void {
        childDestroyed = true;
      }
    }

    const parent: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D);
    const child: Entity = h.world.createEntity();
    h.world.addComponent(child, Transform2D);
    h.world.setParent(child, parent);
    h.scripts.attach(child, ChildScript);
    h.frame();

    createGameEntity(parent, h.world, h.scripts).destroy();
    h.frame();

    expect(childDestroyed).toBe(true);
    expect(h.world.exists(child)).toBe(false);
    expect(h.world.exists(parent)).toBe(false);
  });

  it("Instantiator.destroy destroys the entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    new Instantiator(h.world, h.scripts).destroy(e);
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });
});
