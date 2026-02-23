import { TextureHandle } from "@atlasjs/assets";
import { ISpriteDriver } from "@atlasjs/render/backend";

import { Size, Sprite } from "pixi.js";

import { PixiTextureRegistry } from "../PixiTextureRegistry";
import { PixiNodeDriver } from "./PixiNodeDriver";
import { Box2 } from "@atlasjs/math";

export class PixiSpriteDriver
  extends PixiNodeDriver<Sprite>
  implements ISpriteDriver
{
  private readonly textures: PixiTextureRegistry;

  constructor(textures: PixiTextureRegistry) {
    super(new Sprite());
    this.textures = textures;
  }

  public getTextureSize(): Box2 {
    const size: Size = this.obj.getSize();
    return new Box2(size.width, size.height);
  }

  public setTexture(handle: TextureHandle): void {
    this.obj.texture = this.textures.get(handle);
  }

  public setSize(w: number, h: number): void {
    this.obj.width = w;
    this.obj.height = h;
  }

  public setAnchor(ax: number, ay: number): void {
    this.obj.anchor.set(ax, ay);
  }
}
