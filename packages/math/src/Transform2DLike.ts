import { Vec2Like } from "./Vec2Like";
import { Transform2DValues } from "./Transform2DValues";

export interface Transform2DLike extends Transform2DValues {
  copyFrom(a: Transform2DLike): Transform2DLike;
  setPosition(x: number, y: number): Transform2DLike;
  setScale(x: number, y: number): Transform2DLike;
  setRotation(r: number): Transform2DLike;
  translate(translation: Vec2Like): Transform2DLike;
}
