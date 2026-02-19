import type { SceneContext } from "@atlasjs/core";
import type { Input } from "@atlasjs/input";

import { RectNode, RENDERER, type Renderer } from "@atlasjs/render";
import { Scene } from "@atlasjs/core";

import { Box2 } from "@atlasjs/math";
import { INPUT, Key } from "@atlasjs/input";

export class TestScene extends Scene {
  private t: number;

  private rect: RectNode;
  private input: Input;
  private renderer: Renderer;

  public constructor() {
    super("TestScene");

    this.t = 0;
  }

  public override onCreate(ctx: SceneContext): void | Promise<void> {
    this.renderer = ctx.services.get(RENDERER);
    this.input = ctx.services.get(INPUT);

    this.rect = this.renderer.createRect({
      size: Box2.create(32, 32),
      color: 0xffffff,
    });

    this.renderer.root.add(this.rect);
  }

  public override onUpdate(dt: number): void {
    this.t += dt;

    if (this.input.isDown(Key.D)) {
      this.rect.position.x += 100 * dt;
    }

    if (this.input.isDown(Key.A)) {
      this.rect.position.x -= 100 * dt;
    }

    if (this.input.isDown(Key.S)) {
      this.rect.position.y += 100 * dt;
    }

    if (this.input.isDown(Key.W)) {
      this.rect.position.y -= 100 * dt;
    }

    if (this.input.isDown(Key.MouseLeft)) {
      console.log("Left mouse button is down");
    }
  }
}
