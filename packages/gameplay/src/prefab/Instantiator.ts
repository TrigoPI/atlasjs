import { Entity, NexusWorld } from "@atlasjs/nexus";

import { createGameEntity } from "../scripting/core";
import type {
  GameEntity,
  InstantiateArgs,
  InstantiateOptions,
  Prefab,
} from "../scripting/core";
import type { ScriptManager } from "../scripting/runtime";

import { PrefabEntityBuilder } from "./EntityBuilder";

export type { InstantiateArgs, InstantiateOptions } from "../scripting/core";

// prettier-ignore
export class Instantiator {
  private readonly world: NexusWorld;
  private readonly scripts: ScriptManager;

  public constructor(world: NexusWorld, scripts: ScriptManager) {
    this.world = world;
    this.scripts = scripts;
  }

  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity {
    const params: TParams = rest[0] as TParams;
    const options: InstantiateOptions | undefined = rest[1] as InstantiateOptions | undefined;

    const root: Entity = this.world.createEntity();
    const builder: PrefabEntityBuilder = new PrefabEntityBuilder(root, this.world, this.scripts);

    try {
      prefab.build(builder, params);

      if (options?.parent !== undefined) {
        this.world.setParent(root, options.parent);
      }
    } catch (error: unknown) {
      this.destroy(root);
      throw error;
    }

    return createGameEntity(root, this.world, this.scripts);
  }

  public destroy(entity: Entity): void {
    createGameEntity(entity, this.world, this.scripts).destroy();
  }
}
