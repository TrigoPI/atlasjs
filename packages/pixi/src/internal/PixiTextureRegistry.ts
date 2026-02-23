import { Texture } from "pixi.js";
import { TextureHandle, AssetManager, TextureMeta } from "@atlasjs/assets";

export class PixiTextureRegistry {
  private readonly cache: Map<TextureHandle, Texture>;
  private readonly assets: AssetManager;

  constructor(assets: AssetManager) {
    this.assets = assets;
    this.cache = new Map<TextureHandle, Texture>();
  }

  public get(handle: TextureHandle): Texture {
    const existing: Texture | undefined = this.cache.get(handle);

    if (existing) {
      return existing;
    }

    const meta: TextureMeta = this.assets.getTextureMeta(handle);
    const texture: Texture = Texture.from(meta.image);
    this.cache.set(handle, texture);

    return texture;
  }
}
