import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc, ContactPoint } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";
import { Vec2 } from "@atlasjs/math";

import { Collider2D, RigidBody2D, Transform2D } from "../src/components";
import { AtlasScript, Collision, GameEntity } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";
import { FakeCollider } from "./helpers/fake-physics";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

function contactFromAToB(): ContactPoint {
  return {
    point: new Vec2(5, -2),
    normal: new Vec2(1, 0),
    impulse: 42,
  };
}

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

  function makePair(): { a: Entity; b: Entity } {
    const a: Entity = h.world.createEntity();
    h.world.addComponent(a, Transform2D);
    h.world.addComponent(a, Collider2D, BOX);

    const b: Entity = h.world.createEntity();
    h.world.addComponent(b, Transform2D);
    h.world.addComponent(b, Collider2D, BOX);

    return { a, b };
  }

  function collidersOf(a: Entity, b: Entity): [FakeCollider, FakeCollider] {
    const colliders: FakeCollider[] = [...h.physics.colliders];
    return [
      colliders.find((c: FakeCollider) => c.getUserData<Entity>() === a)!,
      colliders.find((c: FakeCollider) => c.getUserData<Entity>() === b)!,
    ];
  }

  it("carries the contact through to onCollisionEnter", () => {
    const { a, b } = makePair();
    const seen: Collision[] = [];

    class Probe extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        if (collision !== null) {
          seen.push({
            point: collision.point.clone(),
            normal: collision.normal.clone(),
            impulse: collision.impulse,
          });
        }
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const [ca, cb] = collidersOf(a, b);
    h.physics.emitCollision(ca, cb, true, contactFromAToB());
    h.frame();

    expect(seen).toHaveLength(1);
    expect(seen[0].point.x).toBeCloseTo(5, 10);
    expect(seen[0].point.y).toBeCloseTo(-2, 10);
    expect(seen[0].impulse).toBeCloseTo(42, 10);
  });

  it("points the normal from the other entity towards each receiver, opposite on the two sides", () => {
    const { a, b } = makePair();
    const byA: Vec2[] = [];
    const byB: Vec2[] = [];

    class ProbeA extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        byA.push(collision!.normal.clone());
      }
    }

    class ProbeB extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        byB.push(collision!.normal.clone());
      }
    }

    h.scripts.attach(a, ProbeA);
    h.scripts.attach(b, ProbeB);
    h.frame();

    const [ca, cb] = collidersOf(a, b);
    h.physics.emitCollision(ca, cb, true, contactFromAToB());
    h.frame();

    expect(byA).toHaveLength(1);
    expect(byB).toHaveLength(1);

    expect(byA[0].x).toBeCloseTo(-1, 10);
    expect(byA[0].y).toBeCloseTo(0, 10);

    expect(byB[0].x).toBeCloseTo(1, 10);
    expect(byB[0].y).toBeCloseTo(0, 10);

    expect(byA[0].x).toBeCloseTo(-byB[0].x, 10);
    expect(byA[0].y).toBeCloseTo(-byB[0].y, 10);
  });

  it("delivers the same point and impulse to both sides of the pair", () => {
    const { a, b } = makePair();
    const byA: Collision[] = [];
    const byB: Collision[] = [];

    class ProbeA extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        byA.push({
          point: collision!.point.clone(),
          normal: collision!.normal.clone(),
          impulse: collision!.impulse,
        });
      }
    }

    class ProbeB extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        byB.push({
          point: collision!.point.clone(),
          normal: collision!.normal.clone(),
          impulse: collision!.impulse,
        });
      }
    }

    h.scripts.attach(a, ProbeA);
    h.scripts.attach(b, ProbeB);
    h.frame();

    const [ca, cb] = collidersOf(a, b);
    h.physics.emitCollision(ca, cb, true, contactFromAToB());
    h.frame();

    expect(byA[0].point.x).toBeCloseTo(byB[0].point.x, 10);
    expect(byA[0].point.y).toBeCloseTo(byB[0].point.y, 10);
    expect(byA[0].impulse).toBeCloseTo(byB[0].impulse, 10);
  });

  it("hands onCollisionExit a single argument and no collision", () => {
    const { a, b } = makePair();
    const argCounts: number[] = [];

    class Probe extends AtlasScript {
      public onCollisionExit(other: GameEntity): void {
        expect(other.id).toBe(b);
        argCounts.push(arguments.length);
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const [ca, cb] = collidersOf(a, b);
    h.physics.emitCollision(ca, cb, false, contactFromAToB());
    h.frame();

    expect(argCounts).toEqual([1]);
    expect(Probe.prototype.onCollisionExit.length).toBe(1);
  });

  it("passes null when the backend reports no contact", () => {
    const { a, b } = makePair();
    const seen: (Collision | null)[] = [];

    class Probe extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        seen.push(collision);
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const [ca, cb] = collidersOf(a, b);
    h.physics.emitCollision(ca, cb, true);
    h.frame();

    expect(seen).toEqual([null]);
  });

  it("lends the same Collision instance from one contact to the next", () => {
    const { a, b } = makePair();
    const refs: (Collision | null)[] = [];

    class Probe extends AtlasScript {
      public onCollisionEnter(
        _other: GameEntity,
        collision: Collision | null,
      ): void {
        refs.push(collision);
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const [ca, cb] = collidersOf(a, b);

    h.physics.emitCollision(ca, cb, true, contactFromAToB());
    h.frame();

    h.physics.emitCollision(ca, cb, true, contactFromAToB());
    h.frame();

    expect(refs).toHaveLength(2);
    expect(refs[0]).not.toBeNull();
    expect(refs[0]).toBe(refs[1]);
  });
});
