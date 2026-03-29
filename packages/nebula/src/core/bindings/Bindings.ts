import { Mat4 } from "@atlasjs/math";

import { Color } from "../../utils";
import { UniformBuffer } from "../buffers";
import { VertexAttributeFormat } from "../core-types";
import { Sampler, Texture2D } from "../resources";
import { Pipeline } from "../pipeline";
import { Disposable } from "../utils";

export interface Bindings extends Disposable {
  readonly __kind: string;
  readonly pipeline: Pipeline;

  bindSampler(group: number, binding: number, sampler: Sampler): void;
  bindTexture2D(group: number, binding: number, texture: Texture2D): void;
  bindVec4(group: number, binding: number): void;
  bindMat4(group: number, binding: number): void;
  setMat4(group: number, binding: number, mat: Mat4): void;
  bindColor(group: number, binding: number): void;
  setColor(group: number, binding: number, color: Color): void;
  setFloat32Array(group: number, binding: number, data: Float32Array): void;
  bindUniformBuffer(
    group: number,
    binding: number,
    type: VertexAttributeFormat,
  ): UniformBuffer;
}
