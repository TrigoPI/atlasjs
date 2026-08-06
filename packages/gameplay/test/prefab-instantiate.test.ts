import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab, Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("Instantiator.instantiate", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("adds components and applies params", () => {
    const prefab = definePrefab<{ x: number }>({
      build(entity, params): void {
        entity.add(Transform2D).position.set(params.x, 0);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab, { x: 42 }).id;

    const transform: Transform2D = h.world.getComponent(id, Transform2D)!;
    expect(transform.position.x).toBe(42);
  });

  it("attaches scripts declared in build", () => {
    class Marker extends AtlasScript {
      public created: boolean = false;
      public onCreate(): void {
        this.created = true;
      }
    }

    const prefab = definePrefab({
      build(entity): void {
        entity.attach(Marker);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab).id;
    h.frame();

    expect(h.scripts.getScript(id, Marker)?.created).toBe(true);
  });

  it("parents the root when options.parent is given", () => {
    const parent: Entity = h.world.createEntity();
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab, undefined, { parent }).id;

    expect(h.world.getParent(id)).toBe(parent);
  });
});
