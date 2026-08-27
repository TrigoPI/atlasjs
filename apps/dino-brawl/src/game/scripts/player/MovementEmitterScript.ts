/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../../controls";

import {
  AtlasScript,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  type ButtonAction,
  type Repeater,
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
  private emitter: Repeater;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.move = actions.get("move");
    this.boost = actions.get("boost");
    this.emitter = this.every(this.walkInterval, (): void => this.tick());
  }

  public onUpdate(): void {
    const v: Vec2 = this.move.readValue();

    if (v.mag() === 0) {
      this.emitter.reset();
      return;
    }

    this.emitter.interval = this.boost.isDown()
      ? this.runInterval
      : this.walkInterval;
  }

  private tick(): void {
    if (this.move.readValue().mag() === 0) {
      return;
    }

    this.emit();
  }

  protected abstract emit(): void;
}

registerScriptMetadata(MovementEmitterScript, {
  exposed: {
    walkInterval: ScriptMetadata.field(),
    runInterval: ScriptMetadata.field(),
  },
});
