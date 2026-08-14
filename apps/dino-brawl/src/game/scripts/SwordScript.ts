import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

type SwordScriptProps = {
  owner: GameEntity;
};

export class SwordScript extends AtlasScript<SwordScriptProps> {
  private readonly owner: GameEntity;

  private transform: Transform;
  private clock: number;
  private offsetAmplitude: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.clock = 0;
    this.offsetAmplitude = 20;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const ownerTransform: Transform = this.owner.requireComponent(Transform);
    const ownerWorldPosition: Vec2 = ownerTransform.worldPosition.clone();
    const floatingOffset: Vec2 = this.getFloatingOffset();

    ownerWorldPosition.add(floatingOffset);

    this.transform.position.copyFrom(ownerWorldPosition);
  }

  private getFloatingOffset(): Vec2 {
    // const offset: number = Math.sin(this.clock) * this.offsetAmplitude;
    return new Vec2(0, -20);
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    owner: ScriptMetadata.entity({ required: true }),
  },
});
