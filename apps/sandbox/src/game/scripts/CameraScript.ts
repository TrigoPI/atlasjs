import type { Vec2 } from "@atlasjs/math";

import {
  type GameEntity,
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
} from "@atlasjs/gameplay";

export class CameraScript extends AtlasScript<{ target: GameEntity }> {
  private readonly target: GameEntity;

  private transform: Transform;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
  }

  public onUpdate(): void {
    const targetTransform: Transform | undefined =
      this.target.getComponent(Transform);

    if (!targetTransform) {
      return;
    }

    const offset: Vec2 = targetTransform.worldPosition
      .clone()
      .sub(this.transform.position)
      .mult(0.1);

    if (offset.mag() < 0.01) {
      offset.set(0, 0);
    }

    this.transform.position.add(offset);
  }
}

registerScriptMetadata(CameraScript, {
  exposed: {
    target: ScriptMetadata.entity({ required: true }),
  },
});
