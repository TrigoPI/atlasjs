import { Vec2 } from "../vectors";

export interface Transform2DLike {
  readonly position: Vec2;
  readonly scale: Vec2;
  readonly rotation: number;

  setPosition(x: number, y: number): Transform2DLike;
  setScale(x: number, y: number): Transform2DLike;
  setRotation(r: number): Transform2DLike;
  rotate(dr: number): Transform2DLike;
  translate(translation: Vec2): Transform2DLike;
}
