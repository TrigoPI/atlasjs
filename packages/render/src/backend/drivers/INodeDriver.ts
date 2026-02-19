import { Transform2D } from "@atlasjs/math";

export interface INodeDriver {
  setTransform(t: Transform2D): void;
  setVisible(v: boolean): void;
  setAlpha(a: number): void;
  destroy(): void;
}
