import { Sprite, Texture } from "pixi.js";
import { Pool } from "./Pool";

export class SpritePool extends Pool<Sprite> {
  protected afterVisible(): void {}
  protected createNew(): Sprite {
    return new Sprite(Texture.EMPTY);
  }
}
