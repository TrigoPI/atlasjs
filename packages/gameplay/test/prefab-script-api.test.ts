import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("AtlasScript.instantiate / destroy", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("instantiates a prefab through the runtime, params flowing to build", () => {
    const prefab = definePrefab<{ x: number }>({
      build(entity, params): void {
        entity.add(Transform2D).position.set(params.x, 0);
      },
    });

    let spawned: Entity | undefined;
    class Spawner extends AtlasScript {
      public onCreate(): void {
        spawned = this.instantiate(prefab, { x: 7 }).id;
      }
    }

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Spawner);
    h.frame();

    expect(spawned).toBeDefined();
    expect(h.world.getComponent(spawned!, Transform2D)!.position.x).toBe(7);
  });

  it("destroys its own entity via this.destroy()", () => {
    class SelfKill extends AtlasScript {
      public onUpdate(): void {
        this.destroy();
      }
    }

    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.scripts.attach(e, SelfKill);
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });
});
