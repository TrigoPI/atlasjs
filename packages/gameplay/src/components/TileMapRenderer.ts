import { Color } from "@atlasjs/nebula";

export class TileMapRenderer {
  public sortingOrder: number;
  public color: Color;
  public visible: boolean;

  public constructor(
    sortingOrder: number = 0,
    color: Color = Color.White(),
    visible: boolean = true,
  ) {
    this.sortingOrder = sortingOrder;
    this.color = color;
    this.visible = visible;
  }
}
