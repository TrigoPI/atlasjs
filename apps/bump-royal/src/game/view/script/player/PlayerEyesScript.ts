import { PI, PI_2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { PlayerStatus } from "../../../sim";

type PlayerEyesScriptProps = {
  playerEyes: GameEntity;
  radius: number;
  rotationSpeed: number;
};

export class PlayerEyesScript extends AtlasScript<PlayerEyesScriptProps> {
  private readonly playerEyes: GameEntity;
  private readonly rotationSpeed: number;
  private readonly radius: number;

  private status: PlayerStatus;
  private eyeTransform: Transform;

  public onCreate(): void {
    this.status = this.requireComponent(PlayerStatus);
    this.eyeTransform = this.playerEyes.requireComponent(Transform);
  }

  public onUpdate(dt: number): void {
    if (this.status.facing.mag() === 0) {
      return;
    }

    const target: number = this.status.facing.angle();
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
