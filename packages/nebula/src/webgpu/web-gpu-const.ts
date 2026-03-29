import { GlobalBindingDefinition } from "./webgpu-types";

export const BINDING_GROUP_GLOBAL = 0;
export const BINDING_LOCATION_CAMERA = 0;
export const BINDING_LOCATION_TIME = 1;
export const BINDING_LOCATION_RESOLUTION = 2;

export const BINDING_GROUP_MATERIAL = 1;
export const BINDING_LOCATION_COLOR = 0;
export const BINDING_LOCATION_TEXTURE = 0;
export const BINDING_LOCATION_SAMPLER = 1;

export const BINDING_GROUP_OBJECT = 2;
export const BINDING_LOCATION_MODEL = 0;
export const BINDING_LOCATION_SOURCE_RECT = 1;

//prettier-ignore
export const UNIFORM_GLOBALS = (<T extends string>(data: Record<T, GlobalBindingDefinition>): Record<T, GlobalBindingDefinition> => data)({
  "camera": { name: "camera", binding: BINDING_LOCATION_CAMERA, type: "mat4" },
  "time": { name: "time", binding: BINDING_LOCATION_TIME, type: "float32" },
  "resolution": { name: "resolution", binding: BINDING_LOCATION_RESOLUTION, type: "vec2" },
});
