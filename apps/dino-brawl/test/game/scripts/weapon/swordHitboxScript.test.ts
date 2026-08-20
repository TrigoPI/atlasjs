import { describe, expect, it } from "vitest";

import type { Entity } from "@atlasjs/nexus";
import type { GameEntity } from "@atlasjs/gameplay";

import { SwordHitboxScript } from "../../../../src/game/scripts/weapon/SwordHitboxScript";

function createEntity(id: number, alive: boolean = true): GameEntity {
  return {
    id: id as Entity,
    getComponent: (): object | undefined => (alive ? {} : undefined),
  } as unknown as GameEntity;
}

describe("SwordHitboxScript", () => {
  it("has no targets before any trigger event", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();

    expect(hitbox.getTargets()).toHaveLength(0);
  });

  it("tracks a target after onTriggerEnter", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const enemy: GameEntity = createEntity(1);

    hitbox.onTriggerEnter(enemy);

    expect(hitbox.getTargets()).toContain(enemy);
  });

  it("stops tracking a target after onTriggerExit of the same entity", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const enemy: GameEntity = createEntity(1);

    hitbox.onTriggerEnter(enemy);
    hitbox.onTriggerExit(enemy);

    expect(hitbox.getTargets()).toHaveLength(0);
  });

  it("keeps the remaining target while one of two entered entities is still in contact", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const first: GameEntity = createEntity(1);
    const second: GameEntity = createEntity(2);

    hitbox.onTriggerEnter(first);
    hitbox.onTriggerEnter(second);
    hitbox.onTriggerExit(first);

    expect(hitbox.getTargets()).toContain(second);
    expect(hitbox.getTargets()).not.toContain(first);
  });

  it("does not break when onTriggerExit is called for an entity that never entered", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const enemy: GameEntity = createEntity(1);
    const stranger: GameEntity = createEntity(2);

    hitbox.onTriggerEnter(enemy);
    hitbox.onTriggerExit(stranger);

    expect(hitbox.getTargets()).toContain(enemy);
    expect(hitbox.getTargets()).toHaveLength(1);
  });

  it("does not duplicate an entity that enters twice", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const enemy: GameEntity = createEntity(1);

    hitbox.onTriggerEnter(enemy);
    hitbox.onTriggerEnter(enemy);

    expect(hitbox.getTargets()).toHaveLength(1);
  });

  it("stops returning a target that was destroyed without ever receiving onTriggerExit", () => {
    const hitbox: SwordHitboxScript = new SwordHitboxScript();
    const destroyed: GameEntity = createEntity(1, false);

    hitbox.onTriggerEnter(destroyed);

    expect(hitbox.getTargets()).toHaveLength(0);
  });
});
