import { ShaderDescriptor } from "@atlasjs/nebula";

import TextureShader from "../shaders/texture.wgsl";
import GlobalShader from "../shaders/global.wgsl";
import SpriteInstancedShader from "../shaders/sprite_instanced.wgsl";
import ShapeInstancedShader from "../shaders/shape_instanced.wgsl";

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
  SpriteInstanced: {
    id: "atlas.webgpu.sprite_instanced",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: SpriteInstancedShader,
  },
  ShapeInstanced: {
    id: "atlas.webgpu.shape_instanced",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: ShapeInstancedShader,
  },
});

export const WebGPUBuiltinShaders: Record<string, ShaderDescriptor> = {
  sprite: WebGPUShaders.SpriteInstanced,
  texture: WebGPUShaders.Texture2D,
  shape: WebGPUShaders.ShapeInstanced,
};
