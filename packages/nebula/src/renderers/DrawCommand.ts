import { Mat4, Vec4 } from "@atlasjs/math";

import { RenderState } from "../core/core-types";
import { Texture2D, Sampler } from "../core/resources";

export type SpriteDrawCommand = {
  readonly kind: "sprite";
  readonly sortKey: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly model: Mat4;
  readonly uvRect: Vec4;
  readonly tint: Vec4;
};

export type ShapeDrawCommand = {
  readonly kind: "shape";
  readonly sortKey: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

export type DrawCommand = SpriteDrawCommand | ShapeDrawCommand;
