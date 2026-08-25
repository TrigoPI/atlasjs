import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import { Collider2D, RigidBody2D, Transform2D } from "../src/components";
import { AtlasScript, GameEntity } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

describe("Gameplay — collision bridge", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("creates exactly one collider per Collider2D entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);
  });

  it("tags the collider userData with the owning entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getUserData<Entity>()).toBe(e);
  });

  it("attaches the collider to the body when RigidBody2D is present", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getRigidBody()).not.toBeNull();
  });

  it("destroys the collider when Collider2D is removed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.removeComponent(e, Collider2D);
    expect(h.physics.colliderCount).toBe(0);
  });

  it("destroys the collider when the entity is destroyed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.destroyEntity(e);
    expect(h.physics.colliderCount).toBe(0);
  });

  it("places a body-less collider at the entity world position + offset (static)", () => {
    const e: Entity = h.world.createEntity();
    const t: Transform2D = h.world.addComponent(e, Transform2D);
    t.position.set(100, 50);
    const col: Collider2D = h.world.addComponent(e, Collider2D, BOX);
    col.offset.set(5, -3);

    h.frame();

    const collider = [...h.physics.colliders][0];
    expect(collider.getTranslation().x).toBeCloseTo(105, 5);
    expect(collider.getTranslation().y).toBeCloseTo(47, 5);
  });

  it("places a body-attached collider at the offset relative to the body", () => {
    const e: Entity = h.world.createEntity();
    const t: Transform2D = h.world.addComponent(e, Transform2D);
    t.position.set(100, 50);
    h.world.addComponent(e, RigidBody2D);
    const col: Collider2D = h.world.addComponent(e, Collider2D, BOX);
    col.offset.set(5, -3);

    h.frame();

    const collider = [...h.physics.colliders][0];
    expect(collider.getLocalTranslation().x).toBeCloseTo(5, 5);
    expect(collider.getLocalTranslation().y).toBeCloseTo(-3, 5);
    expect(collider.getTranslation().x).toBeCloseTo(105, 5);
    expect(collider.getTranslation().y).toBeCloseTo(47, 5);
  });

  it("dispatches onCollisionEnter to both entities with the other as GameEntity", () => {
    const a: Entity = h.world.createEntity();
    h.world.addComponent(a, Transform2D);
    h.world.addComponent(a, Collider2D, BOX);

    const b: Entity = h.world.createEntity();
    h.world.addComponent(b, Transform2D);
    h.world.addComponent(b, Collider2D, BOX);

    const seenByA: Entity[] = [];

    class Probe extends AtlasScript {
      public onCollisionEnter(other: GameEntity): void {
        seenByA.push(other.id);
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const colliders = [...h.physics.colliders];
    const ca = colliders.find((c) => c.getUserData<Entity>() === a)!;
    const cb = colliders.find((c) => c.getUserData<Entity>() === b)!;

    h.physics.emitCollision(ca, cb, true);
    h.frame();

    expect(seenByA).toContain(b);
  });

  it("routes sensor contacts to onTriggerEnter instead of onCollisionEnter", () => {
    const a: Entity = h.world.createEntity();
    h.world.addComponent(a, Transform2D);
    const colA = h.world.addComponent(a, Collider2D, BOX);
    colA.isSensor = true;

    const b: Entity = h.world.createEntity();
    h.world.addComponent(b, Transform2D);
    h.world.addComponent(b, Collider2D, BOX);

    let collisions: number = 0;
    let triggers: number = 0;

    class Probe extends AtlasScript {
      public onCollisionEnter(): void {
        collisions++;
      }
      public onTriggerEnter(): void {
        triggers++;
      }
    }

    h.scripts.attach(b, Probe);
    h.frame();

    const colliders = [...h.physics.colliders];
    const ca = colliders.find((c) => c.getUserData<Entity>() === a)!;
    const cb = colliders.find((c) => c.getUserData<Entity>() === b)!;

    h.physics.emitCollision(ca, cb, true);
    h.frame();

    expect(triggers).toBe(1);
    expect(collisions).toBe(0);
  });
});
