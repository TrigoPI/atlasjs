import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { mapColliderDesc, mapRigidBodyDesc } from "./mappers";
import { ensureRapierInit } from "./ensure-rapier-init";
import { DEFAULT_CONTROLLER_OFFSET, EARTH_GRAVITY } from "./rapier-const";

import { RapierCollider } from "./RapierCollider";
import { RapierRigidBody } from "./RapierRigidBody";
import { RapierPhysicsQuery } from "./RapierPhyicsQuery";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";
import { RapierCharacterController } from "./RapierCharacterController";

import {
  CharacterController,
  CharacterControllerOptions,
  Collider,
  ColliderDesc,
  CollisionHandler,
  ContactPoint,
  PhysicsQuery,
  PhysicsWorld,
  PhysicsWorldOptions,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
} from "@atlasjs/inertia";

type MutableContactPoint = {
  point: Vec2;
  normal: Vec2;
  impulse: number;
};

export class RapierPhysicsWorld implements PhysicsWorld {
  private readonly bodies: Map<number, RapierRigidBody>;
  private readonly colliders: Map<number, RapierCollider>;
  private readonly controllers: Set<RapierCharacterController>;
  private readonly options: PhysicsWorldOptions;

  private readonly unitsPerMeter: number;
  private readonly converter: PhysicsUnitConverter;
  private readonly contact: MutableContactPoint;

  private queryApi!: PhysicsQuery;
  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;

  public constructor(options: PhysicsWorldOptions = {}) {
    this.options = { ...options };
    this.unitsPerMeter = this.options.unitsPerMeter ?? 1;

    this.converter = new PhysicsUnitConverter(this.unitsPerMeter);
    this.bodies = new Map<number, RapierRigidBody>();
    this.colliders = new Map<number, RapierCollider>();
    this.controllers = new Set<RapierCharacterController>();
    this.contact = {
      point: new Vec2(0, 0),
      normal: new Vec2(0, 0),
      impulse: 0,
    };
  }

  public async init(): Promise<void> {
    await ensureRapierInit();

    const configured: Vec2 | undefined = this.options.gravity;

    const gravity: RAPIER.Vector = {
      x: configured !== undefined ? this.converter.toPhysics(configured.x) : 0,
      y:
        configured !== undefined
          ? this.converter.toPhysics(configured.y)
          : EARTH_GRAVITY,
    };

    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.queryApi = new RapierPhysicsQuery(
      this.world,
      this.converter,
      (handle: number) => this.colliders.get(handle) ?? null,
      (handle: number) => this.bodies.get(handle) ?? null,
    );
  }

  public step(dt: number): void {
    this.world.timestep = dt;
    this.world.step(this.eventQueue);
  }

  public drainCollisions(handler: CollisionHandler): void {
    this.eventQueue.drainCollisionEvents(
      (h1: number, h2: number, started: boolean) => {
        const a: RapierCollider | undefined = this.colliders.get(h1);
        const b: RapierCollider | undefined = this.colliders.get(h2);

        if (a === undefined || b === undefined) {
          return;
        }

        handler(a, b, started, this.resolveContact(a, b, started));
      },
    );
  }

  private resolveContact(
    a: RapierCollider,
    b: RapierCollider,
    started: boolean,
  ): ContactPoint | null {
    if (!started || a.isSensor() || b.isSensor()) {
      return null;
    }

    let found: boolean = false;

    this.world.contactPair(
      a.rapierCollider,
      b.rapierCollider,
      (manifold: RAPIER.TempContactManifold, flipped: boolean) => {
        const count: number = manifold.numContacts();

        if (count === 0) {
          return;
        }

        let best: number = 0;
        let bestImpulse: number = manifold.contactImpulse(0);

        for (let i: number = 1; i < count; i++) {
          const impulse: number = manifold.contactImpulse(i);

          if (impulse > bestImpulse) {
            bestImpulse = impulse;
            best = i;
          }
        }

        if (found && bestImpulse <= this.contact.impulse) {
          return;
        }

        const local: RAPIER.Vector | null = manifold.localContactPoint1(best);

        if (local === null) {
          return;
        }

        const owner: RAPIER.Collider = flipped
          ? b.rapierCollider
          : a.rapierCollider;

        const origin: RAPIER.Vector = owner.translation();
        const angle: number = owner.rotation();
        const cos: number = Math.cos(angle);
        const sin: number = Math.sin(angle);

        this.contact.point.set(
          origin.x + local.x * cos - local.y * sin,
          origin.y + local.x * sin + local.y * cos,
        );

        this.converter.vecToWorldInto(this.contact.point);

        const normal: RAPIER.Vector = manifold.normal();
        const sign: number = flipped ? -1 : 1;

        this.contact.normal.set(normal.x * sign, normal.y * sign);
        this.contact.impulse = bestImpulse;
        found = true;
      },
    );

    return found ? this.contact : null;
  }

  public setGravity(x: number, y: number): void {
    this.world.gravity = {
      x: this.converter.toPhysics(x),
      y: this.converter.toPhysics(y),
    };
  }

  public getGravity(): Vec2 {
    const { x, y }: RAPIER.Vector = this.world.gravity;
    return new Vec2(this.converter.toWorld(x), this.converter.toWorld(y));
  }

  public createRigidBody(descriptor: RigidBodyDesc): RigidBody {
    const unitScale: number = this.unitsPerMeter;
    const rbDesc: RAPIER.RigidBodyDesc = mapRigidBodyDesc(
      descriptor,
      this.converter,
    );

    const rb: RAPIER.RigidBody = this.world.createRigidBody(rbDesc);

    const id: string = String(rb.handle);
    const type: RigidBodyType = descriptor.type ?? "dynamic";
    const wrapper: RapierRigidBody = new RapierRigidBody(rb, {
      id,
      type,
      unitScale,
      lockRotation: descriptor.lockRotation ?? false,
    });

    this.bodies.set(rb.handle, wrapper);
    return wrapper;
  }

  public destroyRigidBody(body: RigidBody): void {
    this.assertRapierBody(body);
    const rb: RAPIER.RigidBody = body.rapierBody;

    if (!this.bodies.has(rb.handle)) {
      return;
    }

    const count: number = rb.numColliders();

    for (let i: number = 0; i < count; i++) {
      this.colliders.delete(rb.collider(i).handle);
    }

    this.bodies.delete(rb.handle);
    this.world.removeRigidBody(rb);
  }

  public createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider {
    const colDesc: RAPIER.ColliderDesc = mapColliderDesc(
      descriptor,
      this.converter,
    );

    let rawCollider: RAPIER.Collider;
    let parentBody: RigidBody | null = null;

    if (body) {
      this.assertRapierBody(body);
      rawCollider = this.world.createCollider(colDesc, body.rapierBody);
      parentBody = body;
    } else {
      rawCollider = this.world.createCollider(colDesc);
    }

    const id: string = String(rawCollider.handle);
    const wrapper: RapierCollider = new RapierCollider(rawCollider, {
      id,
      body: parentBody,
      userData: descriptor.userData,
      converter: this.converter,
    });

    this.colliders.set(rawCollider.handle, wrapper);
    return wrapper;
  }

  public destroyCollider(collider: Collider): void {
    this.assertRapierCollider(collider);
    const handle: number = collider.rapierCollider.handle;

    if (!this.colliders.has(handle)) {
      return;
    }

    this.colliders.delete(handle);
    this.world.removeCollider(collider.rapierCollider, true);
  }

  public syncCollidersWithBodies(): void {
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  public createCharacterController(
    options: CharacterControllerOptions = {},
  ): CharacterController {
    const offset: number =
      options.offset !== undefined
        ? this.converter.toPhysics(options.offset)
        : DEFAULT_CONTROLLER_OFFSET;

    const raw: RAPIER.KinematicCharacterController =
      this.world.createCharacterController(offset);
    raw.setSlideEnabled(options.slide ?? true);

    const wrapper: RapierCharacterController = new RapierCharacterController(
      raw,
      this.converter,
    );

    this.controllers.add(wrapper);
    return wrapper;
  }

  public destroyCharacterController(controller: CharacterController): void {
    this.assertRapierCharacterController(controller);

    if (!this.controllers.has(controller)) {
      return;
    }

    this.controllers.delete(controller);
    this.world.removeCharacterController(controller.raw);
  }

  public query(): PhysicsQuery {
    return this.queryApi;
  }

  public clear(): void {
    for (const controller of [...this.controllers.values()]) {
      this.destroyCharacterController(controller);
    }

    for (const collider of [...this.colliders.values()]) {
      this.destroyCollider(collider);
    }

    for (const body of [...this.bodies.values()]) {
      this.destroyRigidBody(body);
    }
  }

  private assertRapierBody(body: RigidBody): asserts body is RapierRigidBody {
    if (!(body instanceof RapierRigidBody)) {
      throw new Error("Invalid RigidBody");
    }
  }

  private assertRapierCollider(
    collider: Collider,
  ): asserts collider is RapierCollider {
    if (!(collider instanceof RapierCollider)) {
      throw new Error("Invalid Collider");
    }
  }

  private assertRapierCharacterController(
    controller: CharacterController,
  ): asserts controller is RapierCharacterController {
    if (!(controller instanceof RapierCharacterController)) {
      throw new Error("Invalid CharacterController");
    }
  }
}
