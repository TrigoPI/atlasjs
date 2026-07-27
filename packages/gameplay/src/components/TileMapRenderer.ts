import { Color } from "@atlasjs/nebula";

export class TileMapRenderer {
  public sortingOrder: number;
  public color: Color;
  public visible: boolean;
  public sortingLayer: string;

  public constructor(
    sortingOrder: number = 0,
    color: Color = Color.White(),
    visible: boolean = true,
    sortingLayer: string = "Default",
  ) {
    this.sortingOrder = sortingOrder;
    this.color = color;
    this.visible = visible;
    this.sortingLayer = sortingLayer;
  }
}
