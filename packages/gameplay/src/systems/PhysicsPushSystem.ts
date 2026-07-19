import { PhysicsWorld, RigidBody } from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

import {
  PhysicsBodyRef,
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
  private readonly positionScratch: Vec2;

  public constructor(inertia: PhysicsWorld) {
    this.inertia = inertia;
    this.pending = [];
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(RigidBody2D, Transform2D).without(PhysicsBodyRef).each((entity) => {
      this.pending.push(entity);
    });

    for (const entity of this.pending) {
      const rigidBody: RigidBody2D = world.requireComponent(entity, RigidBody2D);
      const transform: Transform2D = world.requireComponent(entity, Transform2D);
      const place: ResolvedPlacement = this.resolvePlacement(world, entity, transform);

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

    world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((entity, rigidBody, transform, ref) => {
      const body: RigidBody = ref.body;

      body.setMass(rigidBody.mass);
      body.setLinearVelocity(rigidBody.velocity.x, rigidBody.velocity.y);
      body.setAngularVelocity(rigidBody.angularVelocity);

      if (rigidBody.type === "kinematic" || rigidBody.type === "static") {
        const place: ResolvedPlacement = this.resolvePlacement(world, entity, transform);
        body.setTranslation(place.x, place.y);
        body.setRotation(place.rotation);
      }
    });
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
}
