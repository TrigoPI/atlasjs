import type { Vec2 } from "@atlasjs/math";

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

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
  }

  public onUpdate(): void {
    const ownerTransform: Transform = this.owner.requireComponent(Transform);
    const ownerWorldPosition: Vec2 = ownerTransform.worldPosition.clone();
    this.transform.position.copyFrom(ownerWorldPosition);
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    owner: ScriptMetadata.entity({ required: true }),
  },
});
