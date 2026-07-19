import { Mat3 } from "@atlasjs/math";
import { RigidBody2D, Transform2D, WorldTransform2D } from "../components";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
  Parent,
} from "@atlasjs/nexus";

export class TransformPropagationSystem implements NexusSystem {
  private readonly localScratch: Mat3;

  public constructor() {
    this.localScratch = Mat3.identity();
  }

  public update({ world }: NexusSystemContext): void {
    this.ensureWorldTransforms(world);

    const roots: Entity[] = world
      .query(Transform2D)
      .without(Parent)
      .getEntities();

    for (let i: number = 0; i < roots.length; i++) {
      this.propagate(world, roots[i], null);
    }
  }

  private ensureWorldTransforms(world: NexusWorld): void {
    const missing: Entity[] = world
      .query(Transform2D)
      .without(WorldTransform2D)
      .getEntities();

    for (let i: number = 0; i < missing.length; i++) {
      world.addComponent(missing[i], WorldTransform2D);
    }
  }

  // prettier-ignore
  private propagate(
    world: NexusWorld,
    entity: Entity,
    parentWorld: Mat3 | null,
  ): void {
    const transform: Transform2D | undefined = world.getComponent(entity, Transform2D);

    let currentWorld: Mat3 | null = parentWorld;

    if (transform !== undefined) {
      const wt: WorldTransform2D = world.requireComponent(entity, WorldTransform2D);
      const rigidBody: RigidBody2D | undefined = world.getComponent(entity, RigidBody2D);
      const isDynamic: boolean = rigidBody !== undefined && rigidBody.type === "dynamic";

      this.localScratch.fromTransform2D(transform);

      if (parentWorld === null || isDynamic) {
        wt.matrix.copy(this.localScratch);
      } else {
        wt.matrix.copy(parentWorld).multiply(this.localScratch);
      }

      currentWorld = wt.matrix;
    }

    const children: ReadonlyArray<Entity> = world.getChildren(entity);

    for (let i: number = 0; i < children.length; i++) {
      this.propagate(world, children[i], currentWorld);
    }
  }
}
