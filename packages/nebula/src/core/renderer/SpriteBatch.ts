import { Mat4, Vec4 } from "@atlasjs/math";

import { Disposable } from "../utils";
import { RenderState } from "../core-types";
import { Texture2D, Sampler } from "../resources";

export interface SpriteBatch extends Disposable {
  readonly __kind: string;
  readonly count: number;

  begin(texture: Texture2D, sampler: Sampler, renderState: RenderState): void;
  add(model: Mat4, uvRect: Vec4, tint: Vec4): void;
}
