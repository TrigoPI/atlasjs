import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { mapColliderDesc, mapRigidBodyDesc } from "./mappers";
import { ensureRapierInit } from "./ensure-rapier-init";
import { EARTH_GRAVITY } from "./rapier-const";

import { RapierCollider } from "./RapierCollider";
import { RapierRigidBody } from "./RapierRigidBody";
import { RapierPhysicsQuery } from "./RapierPhyicsQuery";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";

import {
  Collider,
  ColliderDesc,
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
  private readonly options: PhysicsWorldOptions;

  private readonly unitsPerMeter: number;
  private readonly converter: PhysicsUnitConverter;

  private queryApi!: PhysicsQuery;
  private world!: RAPIER.World;

  public constructor(options: PhysicsWorldOptions = {}) {
    this.options = { ...options };
    this.unitsPerMeter = this.options.unitsPerMeter ?? 1;

    this.converter = new PhysicsUnitConverter(this.unitsPerMeter);
    this.bodies = new Map<number, RapierRigidBody>();
    this.colliders = new Map<number, RapierCollider>();
  }

  public async init(): Promise<void> {
    await ensureRapierInit();

    const gravity: RAPIER.Vector = {
      x: this.options?.gravity?.x ?? 0,
      y: this.options?.gravity?.y ?? EARTH_GRAVITY,
    };

    this.world = new RAPIER.World(gravity);
    this.queryApi = new RapierPhysicsQuery(
      this.world,
      (handle: number) => this.colliders.get(handle) ?? null,
      (handle: number) => this.bodies.get(handle) ?? null,
    );
  }

  public step(): void {
    this.world.step();
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
    this.bodies.delete(body.rapierBody.handle);
    this.world.removeRigidBody(body.rapierBody);
  }

  public createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider {
    const unitScale: number = this.unitsPerMeter;
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
      unitScale,
      body: parentBody,
    });

    this.colliders.set(rawCollider.handle, wrapper);
    return wrapper;
  }

  public destroyCollider(collider: Collider): void {
    this.assertRapierCollider(collider);
    this.colliders.delete(collider.rapierCollider.handle);
    this.world.removeCollider(collider.rapierCollider, true);
  }

  public query(): PhysicsQuery {
    return this.queryApi;
  }

  public clear(): void {
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
}
