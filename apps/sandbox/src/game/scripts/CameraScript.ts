import type { Vec2 } from "@atlasjs/math";

import {
  type GameEntity,
  AtlasScript,
  Camera,
  InputApi,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
} from "@atlasjs/gameplay";

export class CameraScript extends AtlasScript<{ target: GameEntity }> {
  private readonly target: GameEntity;

  private input: InputApi;
  private transform: Transform;
  private camera: Camera;

  private zoom: number;

  public onCreate(): void {
    const transformTarget: Transform = this.target.requireComponent(Transform);

    this.input = this.getService(InputApi);

    this.camera = this.requireComponent(Camera);
    this.transform = this.requireComponent(Transform);
    this.transform.position.copyFrom(transformTarget.worldPosition);

    this.zoom = 1;
  }

  public onUpdate(): void {
    const targetTransform: Transform = this.target.requireComponent(Transform);
    const offset: Vec2 = targetTransform.worldPosition
      .clone()
      .sub(this.transform.position)
      .mult(0.1);

    if (offset.mag() < 0.01) {
      offset.set(0, 0);
    }

    this.zoom -= this.input.scrollDelta * 0.01;
    this.camera.zoom = Math.pow(Math.E, -0.1 * this.zoom);

    this.transform.position.add(offset);
  }
}

registerScriptMetadata(CameraScript, {
  exposed: {
    target: ScriptMetadata.entity({ required: true }),
  },
});
