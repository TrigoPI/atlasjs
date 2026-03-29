import { Shader } from "./pipeline";
import { VertexBufferLayout } from "./buffers";

export type TextureFormat = GPUTextureFormat;
export type Topology = GPUPrimitiveTopology;

export type FilterMode = "nearest" | "linear";
export type IndexFormat = "uint16" | "uint32";
export type AddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
export type ShaderResourceType = "uniform-buffer" | "sampler" | "texture-2d";

export type VertexAttributeFormat =
  | "float32"
  | "vec2"
  | "vec3"
  | "vec4"
  | "mat4"
  | "color";

export type VertexLayoutDescriptor = {
  stride: number;
  attributes: VertexAttributeDescriptor[];
};

export type VertexAttribute = {
  type: VertexAttributeFormat;
  offset: number;
  location: number;
};

export type VertexAttributeDescriptor = {
  location: number;
  offset: number;
  format: VertexAttributeFormat;
};

export type GeometryDescriptor = {
  vertices: Float32Array;
  vertexLayout: VertexLayoutDescriptor;
  vertexCount: number;
  indices: Uint16Array | Uint32Array;
  indexFormat: IndexFormat;
};

export type Texture2DDescriptor = {
  width: number;
  height: number;
  source?: ImageBitmap;
  format?: TextureFormat;
};

export type SamplerDescriptor = {
  magFilter?: FilterMode;
  minFilter?: FilterMode;
  addressModeU?: AddressMode;
  addressModeV?: AddressMode;
};

export type ShaderDefinition = {
  id: string;
  source: string;
  vertexEntryPoint: string;
  fragmentEntryPoint: string;
};

export type PipelineDescriptor = {
  shader: Shader;
  alphaBlend: boolean;
  vertexLayout: VertexBufferLayout;
};
