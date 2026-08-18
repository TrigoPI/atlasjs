import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

type SwordShadowScriptProps = {
  anchor: GameEntity;
  sword: GameEntity;
  shadowOffset: Vec2;
  scale: Vec2;
};

export class SwordShadowScript extends AtlasScript<SwordShadowScriptProps> {
  private readonly anchor: GameEntity;
  private readonly sword: GameEntity;
  private readonly shadowOffset: Vec2;
  private readonly scale: Vec2;

  private transform: Transform;
  private clock: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.clock = 0;
  }

  // prettier-ignore
  public onUpdate(dt: number): void {
    this.clock += dt;

    const anchorTransform: Transform = this.anchor.requireComponent(Transform);
    const swordTransform: Transform = this.sword.requireComponent(Transform);

    const anchorWorld: Vec2 = anchorTransform.worldPosition;
    const swordWorld: Vec2 = swordTransform.worldPosition;

    const floatHeight: number = swordWorld.y - anchorWorld.y;
    const shadowPosition: Vec2 = anchorWorld.clone().add(this.shadowOffset);
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
    shadowOffset: ScriptMetadata.field({ required: true }),
    scale: ScriptMetadata.field({ required: true }),
  },
});
