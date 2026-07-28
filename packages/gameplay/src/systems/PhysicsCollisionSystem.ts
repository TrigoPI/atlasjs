import { Collider, PhysicsWorld } from "@atlasjs/inertia";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

import { AtlasScript, createGameEntity } from "../scripting/core";
import type { GameEntity } from "../scripting/core";
import { ScriptManager } from "../scripting";

export class PhysicsCollisionSystem implements NexusSystem {
  private readonly inertia: PhysicsWorld;
  private readonly scripts: ScriptManager;

  public constructor(inertia: PhysicsWorld, scripts: ScriptManager) {
    this.inertia = inertia;
    this.scripts = scripts;
  }

  public update({ world }: NexusSystemContext): void {
    this.inertia.drainCollisions(
      (a: Collider, b: Collider, started: boolean) => {
        const ea: Entity | undefined = a.getUserData<Entity>();
        const eb: Entity | undefined = b.getUserData<Entity>();

        if (ea === undefined || eb === undefined) {
          return;
        }

        const trigger: boolean = a.isSensor() || b.isSensor();

        this.dispatch(world, ea, eb, trigger, started);
        this.dispatch(world, eb, ea, trigger, started);
      },
    );
  }

  private dispatch(
    world: NexusWorld,
    self: Entity,
    other: Entity,
    trigger: boolean,
    started: boolean,
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
          script.onCollisionEnter?.(handle);
        } else {
          script.onCollisionExit?.(handle);
        }
      }
    }
  }
}
