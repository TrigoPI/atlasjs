import { WebGPUShader } from "./material";
import { WebGPUGeometry } from "./geometry";

import {
  PipelineDescriptor,
  RenderState,
  TextureFormat,
  VertexLayoutDescriptor,
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
};

export type WebGPUPipelineCacheDescriptor = {
  shader: WebGPUShader;
  vertexLayout: VertexLayoutDescriptor;
  format: GPUTextureFormat;
  topology?: GPUPrimitiveTopology;
  renderState?: RenderState;
};

export type WebGPUPipelineDescriptor = PipelineDescriptor & {
  shader: WebGPUShader;
  geometry: WebGPUGeometry;
  format: GPUTextureFormat;
  topology: GPUPrimitiveTopology;
  layout?: GPUPipelineLayout;
  bindGroupLayouts?: ReadonlyArray<GPUBindGroupLayout>;
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
