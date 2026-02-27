import { Texture } from "pixi.js";

import { Texture2D, TextureHandle } from "@atlasjs/assets";
import { TextureResolver } from "@atlasjs/renderer";

export class PixiTextureResolver implements TextureResolver<Texture> {
  private readonly map: Map<TextureHandle, Texture>;

  public constructor() {
    this.map = new Map();
  }

  public resolve(texture: Texture2D): Texture {
    let t: Texture | undefined = this.map.get(texture.id);

    if (!t) {
      t = Texture.from(texture.image);
      this.map.set(texture.id, t);
    }

    return t;
  }
}
