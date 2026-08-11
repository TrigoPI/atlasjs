import type { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../controls";

import {
  AtlasScript,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Vector2Action,
  type Prefab,
} from "@atlasjs/gameplay";

export class RunningAudioPlayerScript extends AtlasScript<{
  audioPrefab: Prefab;
}> {
  private readonly audioPrefab: Prefab;

  private move: Vector2Action;
  private clock: number;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.clock = 0;
    this.move = actions.get("move");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();

    if (v.mag() > 0) {
      this.clock += dt;
    } else {
      this.clock = 0;
    }

    if (this.clock >= 0.3) {
      this.clock = 0;
      this.instantiate(this.audioPrefab);
    }
  }
}

registerScriptMetadata(RunningAudioPlayerScript, {
  exposed: {
    audioPrefab: ScriptMetadata.field({ required: true }),
  },
});
