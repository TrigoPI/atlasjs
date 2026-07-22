import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import { AtlasScript, GameEntity, Transform } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Target extends AtlasScript {
  public hp: number = 42;
}

class Controller extends AtlasScript {
  public otherEntity!: Entity;
  public otherId: Entity | undefined;
  public otherScript: Target | undefined;
  public otherX: number | undefined;

  public onCreate(): void {
    const ge: GameEntity = this.getEntity(this.otherEntity);
    this.otherId = ge.id;
    this.otherScript = ge.getScript(Target);
    ge.addComponent(Transform).setPosition(9, 0);
    this.otherX = ge.requireComponent(Transform).position.x;
  }
}

describe("AtlasScript.getEntity", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("wraps another entity and resolves its components and scripts", () => {
    const target: Entity = h.world.createEntity();
    const t: Target = h.scripts.attach(target, Target);

    const ctrlEntity: Entity = h.world.createEntity();
    const ctrl: Controller = h.scripts.attach(ctrlEntity, Controller);
    ctrl.otherEntity = target;

    h.frame();

    expect(ctrl.otherId).toBe(target);
    expect(ctrl.otherScript).toBe(t);
    expect(ctrl.otherX).toBe(9);
    expect(h.world.requireComponent(target, Transform2D).position.x).toBe(9);
  });
});
