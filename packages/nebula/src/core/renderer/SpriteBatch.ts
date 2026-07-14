import { Mat4, Vec4 } from "@atlasjs/math";

import { Disposable } from "../utils";
import { RenderState } from "../core-types";
import { Texture2D, Sampler } from "../resources";

export interface InstancedBatch extends Disposable {
  readonly __kind: string;
  readonly count: number;
  readonly renderState: RenderState;
}

export interface SpriteBatch extends InstancedBatch {
  begin(texture: Texture2D, sampler: Sampler, renderState: RenderState): void;
  add(model: Mat4, uvRect: Vec4, tint: Vec4): void;
}

export interface ShapeBatch extends InstancedBatch {
  begin(renderState: RenderState): void;
  add(model: Mat4, color: Vec4, params: Vec4): void;
}
