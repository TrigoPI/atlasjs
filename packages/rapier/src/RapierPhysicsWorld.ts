import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { mapColliderDesc, mapRigidBodyDesc } from "./mappers";
import { ensureRapierInit } from "./ensure-rapier-init";
import { EARTH_GRAVITY } from "./rapier-const";

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
  PhysicsQuery,
  PhysicsWorld,
  PhysicsWorldOptions,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
} from "@atlasjs/inertia";

export class RapierPhysicsWorld implements PhysicsWorld {
  private readonly bodies: Map<number, RapierRigidBody>;
  private readonly colliders: Map<number, RapierCollider>;
  private readonly controllers: Set<RapierCharacterController>;
  private readonly options: PhysicsWorldOptions;

  private readonly unitsPerMeter: number;
  private readonly converter: PhysicsUnitConverter;

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
  }

  public async init(): Promise<void> {
    await ensureRapierInit();

    const gravity: RAPIER.Vector = {
      x: this.options?.gravity?.x ?? 0,
      y: this.options?.gravity?.y ?? EARTH_GRAVITY,
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

        handler(a, b, started);
      },
    );
  }

  public setGravity(x: number, y: number): void {
    this.world.gravity = { x, y };
  }

  public getGravity(): Vec2 {
    return new Vec2(this.world.gravity.x, this.world.gravity.y);
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
    const raw: RAPIER.KinematicCharacterController =
      this.world.createCharacterController(options.offset ?? 0.01);
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
