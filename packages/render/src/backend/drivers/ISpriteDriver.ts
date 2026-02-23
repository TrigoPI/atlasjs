import { TextureHandle } from "@atlasjs/assets";
import { INodeDriver } from "./INodeDriver";
import { Box2 } from "@atlasjs/math";

export interface ISpriteDriver extends INodeDriver {
  setTexture(handle: TextureHandle): void;
  setSize(w: number, h: number): void;
  setAnchor(ax: number, ay: number): void;
  getTextureSize(): Box2;
}
