import { TypeLayoutInfo, UniformType } from "./core-types";

export const FLOAT = 4;
export const INT = 4;
export const MAT3 = 48;
export const MAT4 = 64;
export const VEC2 = 8;
export const VEC3 = 12;
export const VEC4 = 16;
export const BOOL = 4;

export const SHADER_PROPERTY_SIZES: Record<UniformType, number> = {
  float: FLOAT,
  vec2: VEC2,
  vec3: VEC3,
  vec4: VEC4,
  mat3: MAT3,
  mat4: MAT4,
  color: VEC4,
  bool: BOOL,
  int: INT,
  buffer: -1,
};

export const SHADER_PROPERTY_LAYOUTS: Record<UniformType, TypeLayoutInfo> = {
  float: { size: FLOAT, align: 4 },
  vec2: { size: VEC2, align: 8 },
  vec3: { size: VEC3, align: 16 },
  vec4: { size: VEC4, align: 16 },
  mat3: { size: MAT3, align: 16 },
  mat4: { size: MAT4, align: 16 },
  color: { size: VEC4, align: 16 },
  bool: { size: BOOL, align: 4 },
  int: { size: INT, align: 4 },
  buffer: { size: -1, align: -1 },
};
