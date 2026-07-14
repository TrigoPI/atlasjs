import { Mat4, Vec4 } from "@atlasjs/math";

import { RenderState } from "../core/core-types";
import { Texture2D, Sampler } from "../core/resources";

export type DrawCommand = {
  readonly sortKey: number;
  readonly batchKey: number;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly renderState: RenderState;
  readonly model: Mat4;
  readonly uvRect: Vec4;
  readonly tint: Vec4;
};
