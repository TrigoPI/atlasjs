import { WebGPUShader } from "./pipeline";
import {
  PipelineDescriptor,
  TextureFormat,
  VertexAttributeFormat,
  VertexLayoutDescriptor,
} from "../core";

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
  alphaBlend?: boolean;
};

export type WebGPUPipelineDescriptor = PipelineDescriptor & {
  shader: WebGPUShader;
  format: GPUTextureFormat;
  topology: GPUPrimitiveTopology;
};

export type GlobalBindingDefinition = {
  name: string;
  binding: number;
  type: VertexAttributeFormat;
};
