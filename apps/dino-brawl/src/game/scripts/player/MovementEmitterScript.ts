/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../../controls";

import {
  AtlasScript,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  type ButtonAction,
  type Vector2Action,
} from "@atlasjs/gameplay";

export type MovementEmitterProps = {
  walkInterval?: number;
  runInterval?: number;
};

export abstract class MovementEmitterScript<
  TProps extends object = {},
> extends AtlasScript<TProps & MovementEmitterProps> {
  protected walkInterval: number;
  protected runInterval: number;

  private move: Vector2Action;
  private boost: ButtonAction;
  private clock: number = 0;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.clock = 0;
    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();

    if (v.mag() === 0) {
      this.clock = 0;
      return;
    }

    this.clock += dt;

    const interval: number = this.boost.isDown()
      ? this.runInterval
      : this.walkInterval;

    if (this.clock >= interval) {
      this.clock = 0;
      this.emit();
    }
  }

  protected abstract emit(): void;
}

registerScriptMetadata(MovementEmitterScript, {
  exposed: {
    walkInterval: ScriptMetadata.field(),
    runInterval: ScriptMetadata.field(),
  },
});
