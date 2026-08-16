import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { orbitBase } from "./orbit";

type SwordShadowScriptProps = {
  anchor: GameEntity;
  sword: GameEntity;
  r: number;
  angle: number;
  angularSpeed: number;
  shadowOffset: Vec2;
  scale: Vec2;
};

export class SwordShadowScript extends AtlasScript<SwordShadowScriptProps> {
  private readonly anchor: GameEntity;
  private readonly sword: GameEntity;
  private readonly r: number;
  private readonly angle: number;
  private readonly angularSpeed: number;
  private readonly shadowOffset: Vec2;
  private readonly scale: Vec2;

  private transform: Transform;
  private clock: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.clock = 0;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const anchorWorld: Vec2 =
      this.anchor.requireComponent(Transform).worldPosition;
    const base: Vec2 = orbitBase(
      anchorWorld,
      this.r,
      this.angle,
      this.angularSpeed,
      this.clock,
    );

    const swordWorld: Vec2 =
      this.sword.requireComponent(Transform).worldPosition;
    const floatHeight: number = swordWorld.y - base.y;

    const shadowPosition: Vec2 = base.clone().add(this.shadowOffset);
    const scaleFactor: Vec2 = this.getScaleFactor(floatHeight, 8).mult(0.3);

    this.transform.position.copyFrom(shadowPosition);
    this.transform.scale.copyFrom(this.scale).add(scaleFactor);
  }

  private getScaleFactor(value: number, max: number): Vec2 {
    const offset: number = (value + max) / 2;
    const normalizedValue: number = Math.min(1, Math.max(0, offset / max));
    return new Vec2(normalizedValue, normalizedValue);
  }
}

registerScriptMetadata(SwordShadowScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    sword: ScriptMetadata.entity({ required: true }),
    r: ScriptMetadata.field({ required: true }),
    angle: ScriptMetadata.field({ required: true }),
    angularSpeed: ScriptMetadata.field({ required: true }),
    shadowOffset: ScriptMetadata.field({ required: true }),
    scale: ScriptMetadata.field({ required: true }),
  },
});
