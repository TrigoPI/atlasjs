import { Transform2D } from "@atlasjs/math";
import { INodeDriver } from "@atlasjs/render/backend";

import { Container } from "pixi.js";

const PIXI_BRAND = Symbol("PIXI_BRAND");

export class PixiNodeDriver<
  T extends Container = Container,
> implements INodeDriver {
  public readonly [PIXI_BRAND] = true as const;
  public readonly obj: T;

  protected constructor(obj: T) {
    this.obj = obj;
  }

  public setTransform({ position, rotation, scale }: Transform2D): void {
    this.obj.position.set(position.x, position.y);
    this.obj.scale.set(scale.x, scale.y);
    this.obj.rotation = rotation;
  }

  public setVisible(v: boolean): void {
    this.obj.visible = v;
  }

  public setAlpha(a: number): void {
    this.obj.alpha = a;
  }

  public destroy(): void {
    this.obj.destroy();
  }

  public static assertPixi(
    child: INodeDriver,
  ): asserts child is PixiNodeDriver {
    if (!(<PixiNodeDriver>child)[PIXI_BRAND]) {
      throw new Error("This node was not created by Pixi backend");
    }
  }
}
