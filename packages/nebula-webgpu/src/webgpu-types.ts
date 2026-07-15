import { WebGPUShader } from "./material";
import { WebGPUGeometry } from "./geometry";

import {
  BlendMode,
  CullMode,
  RenderState,
  TextureFormat,
  UniformType,
  UniformPropertyLayout,
} from "@atlasjs/nebula";

export type UniformKey = `${number}:${number}`;
export type UniformGroup = Map<number, GPUBindGroupEntry>;

export type WebGPUTexture2DOptions = {
  width: number;
  height: number;
  source?: ImageBitmap;
  format?: TextureFormat;
  id?: string;
};

export type WebGPURenderContextOptions = {
  commandEncoder: GPUCommandEncoder;
  renderPass: GPURenderPassEncoder;
  textureView: GPUTextureView;
  format: GPUTextureFormat;
};

export type PipelineKeySpec = {
  readonly variant: "indexed" | "instanced";
  readonly shaderId: string;
  readonly format: GPUTextureFormat;
  readonly blend: BlendMode;
  readonly cull: CullMode;
  readonly depthTest: boolean;
  readonly topology: GPUPrimitiveTopology;
  readonly layoutId?: string;
  readonly hasMaterial?: boolean;
};

export type WebGPUPipelineDescriptor = {
  readonly variant: "indexed" | "instanced";
  readonly shader: WebGPUShader;
  readonly renderState: RenderState;
  readonly format: GPUTextureFormat;
  readonly topology: GPUPrimitiveTopology;
  readonly layout: GPUPipelineLayout;
  readonly bindGroupLayouts: ReadonlyArray<GPUBindGroupLayout>;
  readonly geometry?: WebGPUGeometry;
};

export type GlobalBindingDefinition = {
  name: string;
  binding: number;
  type: UniformType;
};

export type GetUniformPropertiesResult = {
  layout: UniformPropertyLayout[];
  size: number;
};

export type WebGPUShaderBindingGroups = {
  global: number;
  object: number;
  material: number;
};
