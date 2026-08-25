import {
  CharacterController,
  Collider,
  ColliderDesc,
  PhysicsWorld,
  RigidBody,
} from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

import {
  CharacterController2D,
  CharacterControllerRef,
  Collider2D,
  PhysicsBodyRef,
  PhysicsColliderRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../components";

type ResolvedPlacement = {
  x: number;
  y: number;
  rotation: number;
};

export class PhysicsPushSystem implements NexusSystem {
  private readonly inertia: PhysicsWorld;
  private readonly pending: Entity[];
  private readonly pendingColliders: Entity[];
  private readonly pendingControllers: Entity[];
  private readonly positionScratch: Vec2;

  public constructor(inertia: PhysicsWorld) {
    this.inertia = inertia;
    this.pending = [];
    this.pendingColliders = [];
    this.pendingControllers = [];
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D).without(PhysicsBodyRef).each((entity: Entity) => {
      this.pending.push(entity);
    });

    for (const entity of this.pending) {
      const rigidBody: RigidBody2D = world.requireComponent(entity, RigidBody2D);
      const transform: Transform2D = world.requireComponent(entity, Transform2D);
      const place: ResolvedPlacement = rigidBody.type === "dynamic"
        ? { x: transform.position.x, y: transform.position.y, rotation: transform.rotation }
        : this.resolvePlacement(world, entity, transform);

      const body: RigidBody = this.inertia.createRigidBody({
        type: rigidBody.type,
        translation: new Vec2(place.x, place.y),
        rotation: place.rotation,
        linearVelocity: rigidBody.velocity,
        angularVelocity: rigidBody.angularVelocity,
      });

      world.addComponent(entity, PhysicsBodyRef, body);
    }

    this.pending.length = 0;

    world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((entity: Entity, rigidBody: RigidBody2D, transform: Transform2D, ref: PhysicsBodyRef) => {
      const body: RigidBody = ref.body;

      if (body.type !== rigidBody.type) {
        body.setBodyType(rigidBody.type);
      }

      body.setMass(rigidBody.mass);
      body.setLinearVelocity(rigidBody.velocity.x, rigidBody.velocity.y);
      body.setAngularVelocity(rigidBody.angularVelocity);

      if (rigidBody.type === "kinematic" || rigidBody.type === "static") {
        const place: ResolvedPlacement = this.resolvePlacement(world, entity, transform);

        if (rigidBody.type === "kinematic" && !world.hasComponent(entity, CharacterController2D)) {
          body.setNextKinematicTranslation(place.x, place.y);
        } else {
          body.setTranslation(place.x, place.y);
        }

        body.setRotation(place.rotation);
      }
    });

    world.query(Collider2D).without(PhysicsColliderRef).each((entity: Entity) => {
      this.pendingColliders.push(entity);
    });

    for (const entity of this.pendingColliders) {
      const col: Collider2D = world.requireComponent(entity, Collider2D);
      const bodyRef: PhysicsBodyRef | undefined = world.getComponent(entity, PhysicsBodyRef);
      const transform: Transform2D | undefined = world.getComponent(entity, Transform2D);
      const desc: ColliderDesc = this.buildColliderDesc(world, entity, col, bodyRef, transform);
      const collider: Collider = this.inertia.createCollider(desc, bodyRef?.body);
      world.addComponent(entity, PhysicsColliderRef, collider, col);
    }

    this.pendingColliders.length = 0;

    world.query(Collider2D, PhysicsColliderRef).each((_entity: Entity, col: Collider2D, ref: PhysicsColliderRef) => {
      ref.sync(col);
    });

    world.query(CharacterController2D).without(CharacterControllerRef).each((entity: Entity) => {
      this.pendingControllers.push(entity);
    });

    for (const entity of this.pendingControllers) {
      const cfg: CharacterController2D = world.requireComponent(entity, CharacterController2D);
      const controller: CharacterController = this.inertia.createCharacterController({
        offset: cfg.offset,
        slide: cfg.slide,
      });
      world.addComponent(entity, CharacterControllerRef, controller, this.inertia);
    }

    this.pendingControllers.length = 0;
  }

  // prettier-ignore
  private resolvePlacement(
    world: NexusWorld,
    entity: Entity,
    transform: Transform2D,
  ): ResolvedPlacement {
    if (world.getParent(entity) !== undefined) {
      const wt: WorldTransform2D | undefined = world.getComponent(entity, WorldTransform2D);

      if (wt !== undefined) {
        const p: Vec2 = wt.getPosition(this.positionScratch);
        return { x: p.x, y: p.y, rotation: wt.getRotation() };
      }
    }

    return {
      x: transform.position.x,
      y: transform.position.y,
      rotation: transform.rotation,
    };
  }

  // prettier-ignore
  private buildColliderDesc(
    world: NexusWorld,
    entity: Entity,
    col: Collider2D,
    bodyRef: PhysicsBodyRef | undefined,
    transform: Transform2D | undefined,
  ): ColliderDesc {
    let tx: number = col.offset.x;
    let ty: number = col.offset.y;
    let rot: number = col.rotation;

    if (bodyRef === undefined && transform !== undefined) {
      const place: ResolvedPlacement = this.resolvePlacement(world, entity, transform);
      tx = place.x + col.offset.x;
      ty = place.y + col.offset.y;
      rot = place.rotation + col.rotation;
    }

    return {
      shape: col.shape,
      translation: new Vec2(tx, ty),
      rotation: rot,
      sensor: col.isSensor,
      friction: col.friction,
      restitution: col.restitution,
      density: col.density,
      collisionGroup: col.layer,
      collisionMask: col.collidesWith,
      events: true,
      userData: entity,
    };
  }
}
