import { Transform2DLike } from "@atlasjs/math";

export interface INodeDriver {
  setLocalTransform(transform: Transform2DLike): void;
  setVisible(v: boolean): void;
  setAlpha(a: number): void;
  destroy(): void;
}
