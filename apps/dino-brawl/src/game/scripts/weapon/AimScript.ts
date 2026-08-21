import type { Vec2 } from "@atlasjs/math";

import { readAimAngle } from "./aim";

import { AtlasScript, CameraApi, InputApi, Transform } from "@atlasjs/gameplay";

export class AimScript extends AtlasScript {
  private transform: Transform;
  private input: InputApi;
  private camera: CameraApi;

  private aimAngle: number = 0;

  public get angle(): number {
    return this.aimAngle;
  }

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);

    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
  }

  public onUpdate(): void {
    const origin: Vec2 = this.transform.worldPosition;
    this.aimAngle = readAimAngle(this.input, this.camera, origin);
  }
}
