import { Vec2Like } from "./Vec2Like";

export interface Transform2DLike {
  position: Vec2Like;
  scale: Vec2Like;
  rotation: number;

  copyFrom(a: Transform2DLike): Transform2DLike;
  setPosition(x: number, y: number): Transform2DLike;
  setScale(x: number, y: number): Transform2DLike;
  setRotation(r: number): Transform2DLike;
  translate(translation: Vec2Like): Transform2DLike;
  translate(translation: Vec2Like): Transform2DLike;
}
