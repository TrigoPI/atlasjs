import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import type { Collider, ContactPoint, RigidBody } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

const STEP: number = 1 / 60;
const MAX_STEPS: number = 240;
const SURFACE_TOLERANCE_METERS: number = 0.02;

interface ContactResolverHost {
  resolveContact(
    a: Collider,
    b: Collider,
    started: boolean,
  ): ContactPoint | null;
}

type Event = {
  a: Collider;
  b: Collider;
  started: boolean;
  contact: ContactPoint | null;
  contactRef: ContactPoint | null;
  aPosition: Vec2;
  bPosition: Vec2;
};

function snapshot(
  a: Collider,
  b: Collider,
  started: boolean,
  contact: ContactPoint | null,
): Event {
  return {
    a,
    b,
    started,
    contactRef: contact,
    contact:
      contact === null
        ? null
        : {
            point: contact.point.clone(),
            normal: contact.normal.clone(),
            impulse: contact.impulse,
          },
    aPosition: a.getTranslation(),
    bPosition: b.getTranslation(),
  };
}

function runUntilEvents(world: RapierPhysicsWorld, wanted: number): Event[] {
  const events: Event[] = [];

  for (let i: number = 0; i < MAX_STEPS && events.length < wanted; i++) {
    world.step(STEP);
    world.drainCollisions(
      (
        a: Collider,
        b: Collider,
        started: boolean,
        contact: ContactPoint | null,
      ) => {
        events.push(snapshot(a, b, started, contact));
      },
    );
  }

  return events;
}

async function makeWorld(unitsPerMeter: number): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 0),
    unitsPerMeter,
  });

  await world.init();
  return world;
}

type HeadOnScene = {
  world: RapierPhysicsWorld;
  events: Event[];
  left: Collider;
  right: Collider;
};

const SCENE_CENTRE_METERS: number = 5;

async function headOnBoxes(unitsPerMeter: number): Promise<HeadOnScene> {
  const scale: number = unitsPerMeter;
  const centre: number = SCENE_CENTRE_METERS * scale;
  const world: RapierPhysicsWorld = await makeWorld(unitsPerMeter);

  const leftBody: RigidBody = world.createRigidBody({
    type: "dynamic",
    translation: new Vec2(centre - 2 * scale, 0),
    linearVelocity: new Vec2(4 * scale, 0),
    lockRotation: true,
  });

  const rightBody: RigidBody = world.createRigidBody({
    type: "dynamic",
    translation: new Vec2(centre + 2 * scale, 0),
    linearVelocity: new Vec2(-4 * scale, 0),
    lockRotation: true,
  });

  const left: Collider = world.createCollider(
    {
      shape: { type: "box", width: 2 * scale, height: 2 * scale },
      density: 1,
      events: true,
    },
    leftBody,
  );

  const right: Collider = world.createCollider(
    {
      shape: { type: "box", width: 2 * scale, height: 2 * scale },
      density: 1,
      events: true,
    },
    rightBody,
  );

  return { world, events: runUntilEvents(world, 1), left, right };
}

describe("RapierPhysicsWorld collision contacts", () => {
  it("reports a contact when two dynamic bodies hit each other", async () => {
    const { events }: HeadOnScene = await headOnBoxes(1);

    expect(events).toHaveLength(1);
    expect(events[0].started).toBe(true);
    expect(events[0].contact).not.toBeNull();
    expect(events[0].contact!.impulse).toBeGreaterThan(0);
  });

  it("puts the contact point between the two centres, on the shared face", async () => {
    const { events }: HeadOnScene = await headOnBoxes(1);
    const event: Event = events[0];
    const contact: ContactPoint = event.contact!;

    const lowX: number = Math.min(event.aPosition.x, event.bPosition.x);
    const highX: number = Math.max(event.aPosition.x, event.bPosition.x);

    expect(contact.point.x).toBeGreaterThan(lowX);
    expect(contact.point.x).toBeLessThan(highX);

    const face: number = (event.aPosition.x + event.bPosition.x) / 2;

    expect(Math.abs(contact.point.x - face)).toBeLessThan(
      SURFACE_TOLERANCE_METERS,
    );

    expect(Math.abs(contact.point.y - event.aPosition.y)).toBeLessThanOrEqual(
      1 + SURFACE_TOLERANCE_METERS,
    );

    const distanceToA: number = Math.abs(contact.point.x - event.aPosition.x);

    expect(Math.abs(distanceToA - 1)).toBeLessThan(SURFACE_TOLERANCE_METERS);
  });

  it("orients the normal from the first collider towards the second", async () => {
    const { events }: HeadOnScene = await headOnBoxes(1);
    const event: Event = events[0];
    const contact: ContactPoint = event.contact!;

    const towardsB: number = Math.sign(event.bPosition.x - event.aPosition.x);
    const length: number = Math.hypot(contact.normal.x, contact.normal.y);

    expect(length).toBeCloseTo(1, 5);
    expect(Math.sign(contact.normal.x)).toBe(towardsB);
    expect(contact.normal.y).toBeCloseTo(0, 5);
  });

  it("reports the normal in world space, not in the local frame of the first shape", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);

    const diamond: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
      rotation: Math.PI / 4,
      lockRotation: true,
    });

    const bullet: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(-2.4, 1),
      linearVelocity: new Vec2(3, 0),
      lockRotation: true,
    });

    world.createCollider(
      { shape: { type: "box", width: 2, height: 2 }, density: 1, events: true },
      diamond,
    );

    world.createCollider(
      {
        shape: { type: "box", width: 0.4, height: 0.4 },
        density: 1,
        events: true,
      },
      bullet,
    );

    const events: Event[] = runUntilEvents(world, 1);
    const contact: ContactPoint = events[0].contact!;
    const diagonal: number = Math.SQRT1_2;

    expect(Math.abs(contact.normal.x)).toBeCloseTo(diagonal, 4);
    expect(Math.abs(contact.normal.y)).toBeCloseTo(diagonal, 4);

    const facePlane: number =
      -contact.point.x * diagonal + contact.point.y * diagonal;

    expect(Math.abs(facePlane - 1)).toBeLessThan(SURFACE_TOLERANCE_METERS);
  });

  it("reports no contact when one of the colliders is a sensor", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);

    const moving: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(-3, 0),
      linearVelocity: new Vec2(6, 0),
      lockRotation: true,
    });

    const zone: RigidBody = world.createRigidBody({
      type: "static",
      translation: new Vec2(0, 0),
    });

    world.createCollider(
      {
        shape: { type: "box", width: 0.4, height: 0.4 },
        density: 1,
        events: true,
      },
      moving,
    );

    world.createCollider(
      {
        shape: { type: "box", width: 2, height: 2 },
        sensor: true,
        events: true,
      },
      zone,
    );

    const events: Event[] = runUntilEvents(world, 2);

    expect(events.length).toBeGreaterThan(0);

    for (const event of events) {
      expect(event.contact).toBeNull();
    }
  });

  it("reports no contact when the collision ends", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);

    const diamond: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(0, 0),
      rotation: Math.PI / 4,
      lockRotation: true,
    });

    const bullet: RigidBody = world.createRigidBody({
      type: "dynamic",
      translation: new Vec2(-2.4, 1),
      linearVelocity: new Vec2(3, 0),
      lockRotation: true,
    });

    world.createCollider(
      { shape: { type: "box", width: 2, height: 2 }, density: 1, events: true },
      diamond,
    );

    world.createCollider(
      {
        shape: { type: "box", width: 0.4, height: 0.4 },
        density: 1,
        events: true,
      },
      bullet,
    );

    const events: Event[] = runUntilEvents(world, 2);

    expect(events).toHaveLength(2);
    expect(events[1].started).toBe(false);
    expect(events[1].contact).toBeNull();
  });

  it("returns the contact point in world units, not in metres", async () => {
    const scaled: HeadOnScene = await headOnBoxes(100);
    const event: Event = scaled.events[0];
    const contact: ContactPoint = event.contact!;

    const face: number = (event.aPosition.x + event.bPosition.x) / 2;
    const tolerance: number = SURFACE_TOLERANCE_METERS * 100;

    expect(Math.abs(contact.point.x - face)).toBeLessThan(tolerance);

    const distanceToA: number = Math.abs(contact.point.x - event.aPosition.x);

    expect(Math.abs(distanceToA - 100)).toBeLessThan(tolerance);
    expect(Math.abs(contact.point.y - event.aPosition.y)).toBeLessThanOrEqual(
      100 + tolerance,
    );
  });

  it("keeps the point and mirrors the normal when rapier flips the manifold", async () => {
    const scene: HeadOnScene = await headOnBoxes(1);
    const host: ContactResolverHost =
      scene.world as unknown as ContactResolverHost;

    const direct: ContactPoint | null = host.resolveContact(
      scene.left,
      scene.right,
      true,
    );

    expect(direct).not.toBeNull();

    const point: Vec2 = direct!.point.clone();
    const normal: Vec2 = direct!.normal.clone();

    const mirrored: ContactPoint | null = host.resolveContact(
      scene.right,
      scene.left,
      true,
    );

    expect(mirrored).not.toBeNull();
    expect(mirrored!.point.x).toBeCloseTo(point.x, 6);
    expect(mirrored!.point.y).toBeCloseTo(point.y, 6);
    expect(mirrored!.normal.x).toBeCloseTo(-normal.x, 6);
    expect(mirrored!.normal.y).toBeCloseTo(-normal.y, 6);
  });

  it("reuses a single contact object across dispatches", async () => {
    const world: RapierPhysicsWorld = await makeWorld(1);

    const bodies: RigidBody[] = [];

    for (let i: number = 0; i < 2; i++) {
      const left: RigidBody = world.createRigidBody({
        type: "dynamic",
        translation: new Vec2(-2, i * 10),
        linearVelocity: new Vec2(4, 0),
        lockRotation: true,
      });

      const right: RigidBody = world.createRigidBody({
        type: "dynamic",
        translation: new Vec2(2, i * 10),
        linearVelocity: new Vec2(-4, 0),
        lockRotation: true,
      });

      bodies.push(left, right);

      world.createCollider(
        {
          shape: { type: "box", width: 2, height: 2 },
          density: 1,
          events: true,
        },
        left,
      );

      world.createCollider(
        {
          shape: { type: "box", width: 2, height: 2 },
          density: 1,
          events: true,
        },
        right,
      );
    }

    const events: Event[] = runUntilEvents(world, 2);

    expect(events).toHaveLength(2);
    expect(events[0].contactRef).not.toBeNull();
    expect(events[1].contactRef).toBe(events[0].contactRef);
    expect(events[1].contactRef!.point).toBe(events[0].contactRef!.point);
  });
});
