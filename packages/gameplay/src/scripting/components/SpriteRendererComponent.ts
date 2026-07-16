import { Color } from "@atlasjs/nebula";
import { Sprite } from "../../assets";
import { SpriteRender } from "../../components";
import { ScriptComponent } from "../core";

export class SpriteRendererComponent extends ScriptComponent<SpriteRender> {
  public static readonly engine = SpriteRender;

  public get sprite(): Sprite {
    return this.resolve().sprite;
  }

  public set sprite(value: Sprite) {
    this.resolve().sprite = value;
  }

  public get color(): Color {
    return this.resolve().color;
  }

  public set color(value: Color) {
    this.resolve().color = value;
  }

  public get flipX(): boolean {
    return this.resolve().flipX;
  }

  public set flipX(value: boolean) {
    this.resolve().flipX = value;
  }

  public get flipY(): boolean {
    return this.resolve().flipY;
  }

  public set flipY(value: boolean) {
    this.resolve().flipY = value;
  }

  public get visible(): boolean {
    return this.resolve().visible;
  }

  public set visible(value: boolean) {
    this.resolve().visible = value;
  }

  public get sortingOrder(): number {
    return this.resolve().sortingOrder;
  }

  public set sortingOrder(value: number) {
    this.resolve().sortingOrder = value;
  }

  public setSprite(sprite: Sprite): this {
    this.resolve().sprite = sprite;
    return this;
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.resolve().color.set(r, g, b, a);
    return this;
  }

  public setFlip(x: boolean, y: boolean): this {
    const render: SpriteRender = this.resolve();
    render.flipX = x;
    render.flipY = y;
    return this;
  }

  public setVisible(visible: boolean): this {
    this.resolve().visible = visible;
    return this;
  }

  public setSortingOrder(order: number): this {
    this.resolve().sortingOrder = order;
    return this;
  }
}
