import { Scene, type SceneContext } from "@atlasjs/core";
import { INPUT, type Input, Key } from "@atlasjs/input";
import { DragSystem, Picker, PICKING, SelectionSystem } from "@atlasjs/picking";
import { Vec2 } from "@atlasjs/math";

import {
  AssetManager,
  ASSETS,
  NebulaRenderer,
  NEBULA_RENDERER,
  RectNode,
  SpriteNode,
  Texture2D,
} from "@atlasjs/nebula";

const Direction = {
  Up: new Vec2(0, -10),
  Down: new Vec2(0, 10),
  Left: new Vec2(-10, 0),
  Right: new Vec2(10, 0),
};

export class TestScene extends Scene {
  private input: Input;
  private rect: RectNode;
  private sprite: SpriteNode;
  private nebula: NebulaRenderer;
  private picker: Picker;

  public constructor() {
    super("TestScene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    this.picker = ctx.services.get(PICKING);
    this.input = ctx.services.get(INPUT);
    this.nebula = ctx.services.get(NEBULA_RENDERER);

    const assets: AssetManager = ctx.services.get(ASSETS);
    const sealion: Texture2D = await assets.loadTexture(
      "sealion",
      "assets/sealion.png",
    );

    this.rect = this.nebula
      .createRect()
      .setSize(100, 100)
      .setFillColor(0xff0000)
      .setPosition(500, 0);

    this.sprite = this.nebula
      .createSprite(sealion)
      .setScale(0.5, 0.5)
      .setAlpha(0.5);

    this.sprite.add(this.rect);
    this.nebula.root.add(this.sprite);
  }

  public override onUpdate(dt: number): void {
    if (this.input.isDown(Key.D)) {
      this.rect.position.add(Direction.Right);
    }

    if (this.input.isDown(Key.A)) {
      this.rect.position.add(Direction.Left);
    }

    if (this.input.isDown(Key.W)) {
      this.rect.position.add(Direction.Up);
    }

    if (this.input.isDown(Key.S)) {
      this.rect.position.add(Direction.Down);
    }

    if (this.input.isDown(Key.ArrowLeft)) {
      this.sprite.position.add(Direction.Left);
    }

    if (this.input.isDown(Key.ArrowRight)) {
      this.sprite.position.add(Direction.Right);
    }

    if (this.input.isDown(Key.ArrowUp)) {
      this.sprite.position.add(Direction.Up);
    }

    if (this.input.isDown(Key.ArrowDown)) {
      this.sprite.position.add(Direction.Down);
    }

    if (this.input.isDown(Key.R)) {
      this.sprite.rotation += 1 * dt;
    }

    if (this.input.isDown(Key.T)) {
      this.rect.rotation += 1 * dt;
    }

    if (this.input.isDown(Key.F)) {
      this.nebula.camera.rotation += 1 * dt;
    }

    if (this.input.pointer.wheelDelta !== 0) {
      this.nebula.camera.zoom += this.input.pointer.wheelDelta * 0.01;
    }
  }
}
