import { Color } from "@atlasjs/nebula";
import { Sprite } from "../assets";

export class SpriteRender {
  public sprite: Sprite;
  public color: Color;
  public flipX: boolean;
  public flipY: boolean;
  public visible: boolean;
  public sortingOrder: number;
  public sortingLayer: string;

  public constructor(
    sprite: Sprite,
    color: Color = Color.White(),
    flipX: boolean = false,
    flipY: boolean = false,
    visible: boolean = true,
    sortingOrder: number = 0,
    sortingLayer: string = "Default",
  ) {
    this.sprite = sprite;
    this.color = color;
    this.flipX = flipX;
    this.flipY = flipY;
    this.visible = visible;
    this.sortingOrder = sortingOrder;
    this.sortingLayer = sortingLayer;
  }
}
