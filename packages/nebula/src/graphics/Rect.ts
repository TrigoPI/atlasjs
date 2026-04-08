import { Shape } from "./Shape";

export class Rect extends Shape {
  public constructor(w: number = 100, h: number = 100) {
    super();
    this.setSize(w, h);
  }

  public get width(): number {
    return this.transform.scale.x;
  }

  public set width(w: number) {
    this.transform.scale.x = w;
  }

  public get height(): number {
    return this.transform.scale.y;
  }

  public set height(h: number) {
    this.transform.scale.y = h;
  }

  public setSize(w: number, h: number): Rect {
    this.transform.setScale(w, h);
    return this;
  }
}
