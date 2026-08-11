import { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../controls";

import {
  AtlasScript,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  Vector2Action,
  type Prefab,
} from "@atlasjs/gameplay";

export class RunningParticleSpawnerScript extends AtlasScript<{
  runningParticlePrefab: Prefab<{ position: Vec2 }>;
}> {
  private readonly runningParticlePrefab: Prefab<{ position: Vec2 }>;

  private transform: Transform;
  private move: Vector2Action;
  private clock: number;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.transform = this.requireComponent(Transform);
    this.move = actions.get("move");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();

    this.clock += dt;

    if (v.mag() === 0) {
      this.clock = 0;
    }

    if (this.clock >= 0.15) {
      this.clock = 0;
      this.instantiate(this.runningParticlePrefab, {
        position: this.transform.worldPosition.clone(),
      });
    }
  }
}

registerScriptMetadata(RunningParticleSpawnerScript, {
  exposed: {
    runningParticlePrefab: ScriptMetadata.field({ required: true }),
  },
});
