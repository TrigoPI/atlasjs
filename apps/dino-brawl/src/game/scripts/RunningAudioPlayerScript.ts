import type { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../controls";

import {
  AtlasScript,
  ButtonAction,
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
  private boost: ButtonAction;
  private clock: number;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.clock = 0;
    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const boost: boolean = this.boost.isDown();
    const cooldown: number = boost ? 0.25 : 0.3;

    if (v.mag() > 0) {
      this.clock += dt;
    } else {
      this.clock = 0;
    }

    if (this.clock >= cooldown) {
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
