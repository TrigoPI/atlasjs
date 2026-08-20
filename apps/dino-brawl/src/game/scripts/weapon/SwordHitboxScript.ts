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

  public getTargets(): readonly GameEntity[] {
    this.pruneDeadTargets();
    return Array.from(this.targets.values());
  }

  private pruneDeadTargets(): void {
    for (const [id, handle] of this.targets) {
      if (handle.getComponent(Transform) === undefined) {
        this.targets.delete(id);
      }
    }
  }
}
