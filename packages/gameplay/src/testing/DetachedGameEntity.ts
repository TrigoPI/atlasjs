import type { Entity } from "@atlasjs/nexus";

import type { GameEntity } from "../scripting/core";

class DetachedGameEntity implements GameEntity {
  public readonly id: Entity;

  public constructor(id: Entity) {
    this.id = id;
  }

  public hasComponent(): never {
    throw this.unsupported("hasComponent");
  }

  public getComponent(): never {
    throw this.unsupported("getComponent");
  }

  public addComponent(): never {
    throw this.unsupported("addComponent");
  }

  public removeComponent(): never {
    throw this.unsupported("removeComponent");
  }

  public requireComponent(): never {
    throw this.unsupported("requireComponent");
  }

  public getScript(): never {
    throw this.unsupported("getScript");
  }

  public destroy(): never {
    throw this.unsupported("destroy");
  }

  private unsupported(member: string): Error {
    return new Error(
      `[DetachedGameEntity] "${member}" is unavailable on entity "${this.id}": this handle carries an id only. Pass "wrapEntity" to the harness to back it with a real world.`,
    );
  }
}

export function createDetachedGameEntity(id: Entity): GameEntity {
  return new DetachedGameEntity(id);
}
