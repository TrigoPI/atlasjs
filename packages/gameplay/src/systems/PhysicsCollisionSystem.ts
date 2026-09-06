import { Collider, PhysicsWorld } from "@atlasjs/inertia";
import type { ContactPoint } from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

import { AtlasScript, createGameEntity } from "../scripting/core";
import type { Collision, GameEntity } from "../scripting/core";
import { ScriptManager } from "../scripting";

type MutableCollision = {
  point: Vec2;
  normal: Vec2;
  impulse: number;
};

const NORMAL_TOWARDS_A: number = -1;
const NORMAL_TOWARDS_B: number = 1;

export class PhysicsCollisionSystem implements NexusSystem {
  private readonly inertia: PhysicsWorld;
  private readonly scripts: ScriptManager;
  private readonly collision: MutableCollision;

  public constructor(inertia: PhysicsWorld, scripts: ScriptManager) {
    this.inertia = inertia;
    this.scripts = scripts;
    this.collision = {
      point: new Vec2(0, 0),
      normal: new Vec2(0, 0),
      impulse: 0,
    };
  }

  public update({ world }: NexusSystemContext): void {
    this.inertia.drainCollisions(
      (
        a: Collider,
        b: Collider,
        started: boolean,
        contact: ContactPoint | null,
      ) => {
        const ea: Entity | undefined = a.getUserData<Entity>();
        const eb: Entity | undefined = b.getUserData<Entity>();

        if (ea === undefined || eb === undefined) {
          return;
        }

        const trigger: boolean = a.isSensor() || b.isSensor();

        this.dispatch(
          world,
          ea,
          eb,
          trigger,
          started,
          this.borrowCollision(contact, NORMAL_TOWARDS_A),
        );

        this.dispatch(
          world,
          eb,
          ea,
          trigger,
          started,
          this.borrowCollision(contact, NORMAL_TOWARDS_B),
        );
      },
    );
  }

  private borrowCollision(
    contact: ContactPoint | null,
    normalSign: number,
  ): Collision | null {
    if (contact === null) {
      return null;
    }

    const collision: MutableCollision = this.collision;

    collision.point.copyFrom(contact.point);
    collision.normal.set(
      contact.normal.x * normalSign,
      contact.normal.y * normalSign,
    );
    collision.impulse = contact.impulse;

    return collision;
  }

  private dispatch(
    world: NexusWorld,
    self: Entity,
    other: Entity,
    trigger: boolean,
    started: boolean,
    collision: Collision | null,
  ): void {
    const scripts: readonly AtlasScript[] =
      this.scripts.getScriptsByEntity(self);

    if (scripts.length === 0) {
      return;
    }

    const handle: GameEntity = createGameEntity(other, world, this.scripts);

    for (const script of scripts) {
      if (trigger) {
        if (started) {
          script.onTriggerEnter?.(handle);
        } else {
          script.onTriggerExit?.(handle);
        }
      } else {
        if (started) {
          script.onCollisionEnter?.(handle, collision);
        } else {
          script.onCollisionExit?.(handle);
        }
      }
    }
  }
}
