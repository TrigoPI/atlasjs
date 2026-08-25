import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { CharacterController2D, Transform2D } from "../src/components";
import {
  CharacterController,
  GameEntity,
  Transform,
  createGameEntity,
} from "../src/scripting";
import { definePrefab, Instantiator, Prefab } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

class Health {
  public hp: number;

  public constructor(hp: number = 100) {
    this.hp = hp;
  }
}

describe("GameEntity.addComponent — arguments on an existing component", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("raw branch: throws when args would be dropped on an existing component", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(Health, 50);

    expect(() => ge.addComponent(Health, 10)).toThrow(/Health/);
    expect(h.world.requireComponent(e, Health).hp).toBe(50);
  });

  it("raw branch: names the entity in the error message", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(Health, 50);

    expect(() => ge.addComponent(Health, 10)).toThrow(new RegExp(`${e}`));
  });

  it("raw branch: stays idempotent without args and returns the existing instance", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    const first: Health = ge.addComponent(Health, 50);
    const second: Health = ge.addComponent(Health);

    expect(second).toBe(first);
    expect(second.hp).toBe(50);
  });

  it("token branch: throws when args would be dropped on an existing component", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(CharacterController, { offset: 0.5, slide: false });

    expect(() =>
      ge.addComponent(CharacterController, { offset: 0.25, slide: true }),
    ).toThrow(/CharacterController2D/);

    const real: CharacterController2D = h.world.requireComponent(
      e,
      CharacterController2D,
    );

    expect(real.offset).toBe(0.5);
    expect(real.slide).toBe(false);
  });

  it("token branch: stays idempotent without args", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(Transform).setPosition(7, 8);
    const again: Transform = ge.addComponent(Transform);

    expect(again.position.x).toBe(7);
    expect(again.position.y).toBe(8);
    expect(h.world.requireComponent(e, Transform2D).position.x).toBe(7);
  });

  it("PrefabEntityBuilder.add surfaces the error", () => {
    const prefab: Prefab<void> = definePrefab({
      build(entity): void {
        entity.add(Health, 50);
        entity.add(Health, 10);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);

    expect(() => inst.instantiate(prefab)).toThrow(/Health/);
  });
});
