import { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../../controls";
import type { RunningParticlePrefabProps } from "../../prefabs";

import {
  AtlasScript,
  ButtonAction,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  Vector2Action,
  type Prefab,
} from "@atlasjs/gameplay";

export class RunningParticleSpawnerScript extends AtlasScript<{
  runningParticlePrefab: Prefab<RunningParticlePrefabProps>;
}> {
  private readonly runningParticlePrefab: Prefab<RunningParticlePrefabProps>;

  private transform: Transform;
  private clock: number;

  private move: Vector2Action;
  private boost: ButtonAction;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.transform = this.requireComponent(Transform);

    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const boost: boolean = this.boost.isDown();
    const cooldown: number = boost ? 0.09 : 0.15;

    this.clock += dt;

    if (v.mag() === 0) {
      this.clock = 0;
    }

    if (this.clock >= cooldown) {
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
