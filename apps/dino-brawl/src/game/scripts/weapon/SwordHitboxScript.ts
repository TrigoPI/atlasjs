import type { Entity } from "@atlasjs/nexus";

import { AtlasScript, Transform, type GameEntity } from "@atlasjs/gameplay";

export class SwordHitboxScript extends AtlasScript {
  private readonly targets: Map<Entity, GameEntity> = new Map();

  public onTriggerEnter(other: GameEntity): void {
    this.targets.set(other.id, other);
  }

  public onTriggerExit(other: GameEntity): void {
    this.targets.delete(other.id);
  }

  public hasTargets(): boolean {
    this.pruneDeadTargets();
    return this.targets.size > 0;
  }

  public getTargets(): readonly Entity[] {
    this.pruneDeadTargets();
    return Array.from(this.targets.keys());
  }

  private pruneDeadTargets(): void {
    for (const [id, handle] of this.targets) {
      if (handle.getComponent(Transform) === undefined) {
        this.targets.delete(id);
      }
    }
  }
}
