import type { Vec2 } from "@atlasjs/math";
import type { WorldTransform2D } from "../components/WorldTransform2D";

export interface TransformTarget {
  setPosition(x: number, y: number): void;
  setRotation(angle: number): void;
  setScale(x: number, y: number): void;
}

export function syncNodeTransform(
  target: TransformTarget,
  worldTransform: WorldTransform2D,
  positionScratch: Vec2,
  scaleScratch: Vec2,
  flipX: boolean,
  flipY: boolean,
): Vec2 {
  const position: Vec2 = worldTransform.getPosition(positionScratch);
  const scale: Vec2 = worldTransform.getScale(scaleScratch);

  target.setPosition(position.x, position.y);
  target.setRotation(worldTransform.getRotation());
  target.setScale(scale.x * (flipX ? -1 : 1), scale.y * (flipY ? -1 : 1));

  return position;
}
