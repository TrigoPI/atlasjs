import { Mat4, Vec2 } from "@atlasjs/math";

import { Sampler, Texture2D } from "./resources";
import { Color } from "../utils";
import { Shader } from "./material";
import { Geometry } from "./geometry";

export type TextureFormat = GPUTextureFormat;
export type Topology = GPUPrimitiveTopology;
export type ShaderValueType = BindingGroupProperty["type"];

export type BindingGroupPropertyType = ShaderValueType;
export type MaterialValue = BindingValue;

export type FilterMode = "nearest" | "linear";
export type IndexFormat = "uint16" | "uint32";
export type AddressMode = "clamp-to-edge" | "repeat" | "mirror-repeat";
export type ShaderResourceType = "uniform-buffer" | "sampler" | "texture-2d";
export type ResourcePropertyType = "texture2D" | "sampler";
export type UniformType = Exclude<ShaderValueType, "texture2D" | "sampler">;

export type VertexAttributeFormat = Exclude<
  ShaderValueType,
  "buffer" | "texture2D" | "sampler" | "mat4"
>;

export type BindingValue =
  | number
  | boolean
  | Color
  | Vec2
  | Mat4
  | Texture2D
  | Sampler
  | ArrayBufferView
  | null;

export type VertexLayoutDescriptor = {
  readonly stride: number;
  readonly attributes: VertexAttributeDescriptor[];
};

export type VertexAttribute = {
  readonly type: VertexAttributeFormat;
  readonly offset: number;
  readonly location: number;
};

export type TypeLayoutInfo = {
  readonly size: number;
  readonly align: number;
};

export type VertexAttributeDescriptor = {
  readonly location: number;
  readonly offset: number;
  readonly format: UniformType;
};

export type GeometryDescriptor = {
  readonly vertices: Float32Array;
  readonly vertexLayout: VertexLayoutDescriptor;
  readonly vertexCount: number;
  readonly indices: Uint16Array | Uint32Array;
  readonly indexFormat: IndexFormat;
};

export type Texture2DDescriptor = {
  readonly width: number;
  readonly height: number;
  readonly source?: ImageBitmap;
  readonly format?: TextureFormat;
};

export type SamplerDescriptor = {
  readonly magFilter?: FilterMode;
  readonly minFilter?: FilterMode;
  readonly addressModeU?: AddressMode;
  readonly addressModeV?: AddressMode;
};

export type BindingGroupPropertyFloat = {
  readonly type: "float";
  readonly name: string;
  readonly defaultValue?: number;
};

export type BindingGroupPropertyInt = {
  readonly type: "int";
  readonly name: string;
  readonly defaultValue?: number;
};

export type BindingGroupPropertyBool = {
  readonly type: "bool";
  readonly name: string;
  readonly defaultValue?: boolean;
};

export type BindingGroupPropertyVec2 = {
  readonly type: "vec2";
  readonly name: string;
  readonly defaultValue?: Vec2;
};

export type BindingGroupPropertyMat4 = {
  readonly type: "mat4";
  readonly name: string;
  readonly defaultValue?: Mat4;
};

export type BindingGroupPropertyColor = {
  readonly type: "color";
  readonly name: string;
  readonly defaultValue?: Color;
};

export type BindingGroupPropertyTexture2D = {
  readonly type: "texture2D";
  readonly name: string;
  readonly defaultValue?: Texture2D | null;
};

export type BindingGroupPropertySampler = {
  readonly type: "sampler";
  readonly name: string;
  readonly defaultValue?: Sampler | null;
};

export type BindingGroupPropertyBuffer = {
  readonly type: "buffer";
  readonly name: string;
  readonly size: number;
  readonly align?: number;
  readonly defaultValue?: ArrayBufferView;
};

export type ShaderDescriptor = {
  readonly id: string;
  readonly source: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;
};

export type PipelineDescriptor = {
  readonly shader: Shader;
  readonly geometry: Geometry;
  readonly alphaBlend: boolean;
};

export type UniformPropertyLayout = {
  readonly name: string;
  readonly type: UniformType;
  readonly offset: number;
  readonly size: number;
  readonly align: number;
};

export type ResourcePropertyLayout = {
  readonly name: string;
  readonly type: ResourcePropertyType;
  readonly binding: number;
};

export type BindingGroupProperty =
  | BindingGroupPropertyFloat
  | BindingGroupPropertyInt
  | BindingGroupPropertyBool
  | BindingGroupPropertyVec2
  | BindingGroupPropertyMat4
  | BindingGroupPropertyColor
  | BindingGroupPropertyTexture2D
  | BindingGroupPropertySampler
  | BindingGroupPropertyBuffer;
