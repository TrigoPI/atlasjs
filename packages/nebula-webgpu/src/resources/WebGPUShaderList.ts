import { ShaderDescriptor } from "@atlasjs/nebula";

import TextureShader from "../shaders/texture.wgsl";
import GlobalShader from "../shaders/global.wgsl";

export const WebGPUShaders = (<T extends Record<string, ShaderDescriptor>>(
  list: T,
): Record<keyof T, ShaderDescriptor> => list)({
  Global: {
    id: "atlas.webgpu.Global",
    vertexEntryPoint: "",
    fragmentEntryPoint: "",
    source: GlobalShader,
  },
  Texture2D: {
    id: "atlas.webgpu.texture2d",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: TextureShader,
  },
});
