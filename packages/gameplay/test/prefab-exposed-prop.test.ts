import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import {
  AtlasScript,
  Prefab,
  ScriptMetadata,
  Transform2D,
  definePrefab,
  registerScriptMetadata,
} from "../src";
import { createHarness, Harness } from "./helpers/harness";

describe("prefab passed as an exposed prop", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("instantiates with params flowing into an attached script", () => {
    class Bullet extends AtlasScript<{ direction: number }> {
      public direction!: number;
    }
    registerScriptMetadata(Bullet, {
      exposed: { direction: ScriptMetadata.field({ required: true }) },
    });

    const bulletPrefab: Prefab<{ direction: number }> = definePrefab<{
      direction: number;
    }>({
      name: "bullet",
      build(entity, params): void {
        entity.add(Transform2D);
        entity.attach(Bullet, { direction: params.direction });
      },
    });

    let bulletId: Entity | undefined;
    class Shooter extends AtlasScript<{
      prefab: Prefab<{ direction: number }>;
    }> {
      public prefab!: Prefab<{ direction: number }>;
      public onCreate(): void {
        bulletId = this.instantiate(this.prefab, { direction: 3 }).id;
      }
    }
    registerScriptMetadata(Shooter, {
      exposed: { prefab: ScriptMetadata.field({ required: true }) },
    });

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Shooter, { prefab: bulletPrefab });
    h.frame();

    expect(bulletId).toBeDefined();
    expect(h.scripts.getScript(bulletId!, Bullet)?.direction).toBe(3);
  });
});
