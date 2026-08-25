import { Sprite } from "./Sprite";

export class Tile {
  public readonly index: number;
  public readonly sprite: Sprite;

  public constructor(index: number, sprite: Sprite) {
    this.index = index;
    this.sprite = sprite;
  }
}
