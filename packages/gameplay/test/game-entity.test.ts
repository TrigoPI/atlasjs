import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import {
  AtlasScript,
  GameEntity,
  Transform,
  createGameEntity,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Marker extends AtlasScript {
  public label: string = "marker";
}

describe("GameEntity handle", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("exposes the target entity id", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.id).toBe(e);
  });

  it("addComponent(token) adds the backing engine component on the target", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    const t: Transform = ge.addComponent(Transform);
    t.setPosition(5, 6);

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    expect(h.world.requireComponent(e, Transform2D).position.x).toBe(5);
  });

  it("hasComponent / getComponent reflect the target entity", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.hasComponent(Transform)).toBe(false);
    expect(ge.getComponent(Transform)).toBeUndefined();

    ge.addComponent(Transform);

    expect(ge.hasComponent(Transform)).toBe(true);
    expect(ge.getComponent(Transform)).toBeDefined();
  });

  it("requireComponent throws when the component is missing", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(() => ge.requireComponent(Transform)).toThrow();
  });

  it("removeComponent removes the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(Transform);
    ge.removeComponent(Transform);

    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });

  it("getScript resolves a script attached to the target entity", () => {
    const e: Entity = h.world.createEntity();
    const m: Marker = h.scripts.attach(e, Marker);
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.getScript(Marker)).toBe(m);
  });
});
