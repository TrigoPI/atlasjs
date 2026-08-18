import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  CameraApi,
  InputApi,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { readAimAngle } from "./aim";

type SwordAnchorScriptProps = {
  anchor: GameEntity;
  angle: number;
  r: number;
};

export class SwordAnchorScript extends AtlasScript<SwordAnchorScriptProps> {
  private readonly anchor: GameEntity;
  private readonly angle: number;
  private readonly r: number;

  private transform: Transform;

  private input: InputApi;
  private camera: CameraApi;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
  }

  public onUpdate(): void {
    const anchorTransform: Transform = this.anchor.requireComponent(Transform);

    const orbit: number = this.getOrbitAngle();
    const x: number = Math.cos(this.angle + orbit) * this.r;
    const y: number = Math.sin(this.angle + orbit) * this.r;
    const position: Vec2 = Vec2.create(x, y);

    this.transform.position
      .copyFrom(anchorTransform.worldPosition)
      .add(position);
  }

  private getOrbitAngle(): number {
    const anchorTransform: Transform = this.anchor.requireComponent(Transform);
    const anchorWorldPos: Vec2 = anchorTransform.worldPosition;
    return readAimAngle(this.input, this.camera, anchorWorldPos);
  }
}

registerScriptMetadata(SwordAnchorScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    angle: ScriptMetadata.field({ required: true }),
    r: ScriptMetadata.field({ required: true }),
  },
});
