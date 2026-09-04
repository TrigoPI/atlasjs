import { PI, PI_2, Vec2 } from "@atlasjs/math";
import type { PlayerControlsType } from "@bump-royal/game/controls";

import {
  AtlasScript,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  Vector2Action,
  type GameEntity,
} from "@atlasjs/gameplay";

type PlayerEyesScriptProps = {
  playerEyes: GameEntity;
  radius: number;
  rotationSpeed: number;
};

export class PlayerEyesScript extends AtlasScript<PlayerEyesScriptProps> {
  private readonly playerEyes: GameEntity;
  private readonly rotationSpeed: number;
  private readonly radius: number;

  private readonly direction: Vec2 = new Vec2();

  private move: Vector2Action;
  private eyeTransform: Transform;

  public onCreate(): void {
    const controls: PlayerInput<PlayerControlsType> =
      this.requireComponent(PlayerInput);

    this.eyeTransform = this.playerEyes.requireComponent(Transform);
    this.move = controls.get("move");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();

    if (v.mag() > 0) {
      this.direction.copyFrom(v).normalize();
    }

    if (this.direction.mag() === 0) {
      return;
    }

    const target: number = this.direction.angle();
    const rotation: number = this.eyeTransform.position.angle();
    const delta: number = this.shortestDelta(rotation, target);

    const t: number = 1 - Math.exp(-this.rotationSpeed * dt);
    const to: number = rotation + delta * t;

    const x: number = Math.cos(to) * this.radius;
    const y: number = Math.sin(to) * this.radius;

    this.eyeTransform.setPosition(x, y);
  }

  private shortestDelta(from: number, to: number): number {
    const delta: number = (to - from) % PI_2;

    if (delta > PI) return delta - PI_2;
    if (delta < -PI) return delta + PI_2;

    return delta;
  }
}

registerScriptMetadata(PlayerEyesScript, {
  exposed: {
    playerEyes: ScriptMetadata.entity({ required: true }),
    rotationSpeed: ScriptMetadata.field({ required: true }),
    radius: ScriptMetadata.field({ required: true }),
  },
});
