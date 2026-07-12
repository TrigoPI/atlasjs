import { Texture2D } from "@atlasjs/nebula";

export class SpriteRender {
  public texture: Texture2D;
  public visible: boolean;

  public constructor(texture: Texture2D, visible: boolean = true) {
    this.texture = texture;
    this.visible = visible;
  }
}
