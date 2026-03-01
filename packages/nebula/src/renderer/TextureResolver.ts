import type { Texture2D } from "@atlasjs/assets";

export interface TextureResolver<TNativeTexture = unknown> {
  resolve(handle: Texture2D): TNativeTexture;
}
