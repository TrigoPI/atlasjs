import { Vec2 } from "@atlasjs/math";

import type { CameraApi, InputApi } from "@atlasjs/gameplay";

export function readAimAngle(
  input: InputApi,
  camera: CameraApi,
  origin: Vec2,
): number {
  const mouseScreenPos: Vec2 = input.mousePosition;
  const mouseWorldPos: Vec2 = camera.screenToWorld(mouseScreenPos);
  const direction: Vec2 = Vec2.sub(mouseWorldPos, origin);
  return direction.angle();
}
