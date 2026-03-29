import { VertexAttributeFormat } from "./core-types";

export const FLOAT32 = 4;
export const FLOAT64 = 8;
export const INT32 = 4;
export const UINT32 = 4;
export const MAT4 = 64;
export const VEC2 = 8;
export const VEC3 = 12;
export const VEC4 = 16;

export const VERTEX_ATTRIBUTE_SIZES: Record<VertexAttributeFormat, number> = {
  float32: FLOAT32,
  vec2: VEC2,
  vec3: VEC3,
  vec4: VEC4,
  mat4: MAT4,
  color: VEC4,
};
