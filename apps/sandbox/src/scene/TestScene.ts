import { RectNode, RENDERER, SpriteNode, type Renderer } from "@atlasjs/render";
import { AssetManager, ASSETS, type TextureHandle } from "@atlasjs/assets";
import { INPUT, Key, type Input } from "@atlasjs/input";
import { Scene, type SceneContext } from "@atlasjs/core";
import { DragSystem, Picker, PICKING, SelectionSystem } from "@atlasjs/picking";
import { Vec2 } from "@atlasjs/math";

const Direction = {
  Up: new Vec2(0, -10),
  Down: new Vec2(0, 10),
  Left: new Vec2(-10, 0),
  Right: new Vec2(10, 0),
};

export class TestScene extends Scene {
  private t: number;

  private rect: SpriteNode;
  private input: Input;
  private renderer: Renderer;
  private assets: AssetManager;
  private picker: Picker;

  public constructor() {
    super("TestScene");
    this.t = 0;
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    this.renderer = ctx.services.get(RENDERER);
    this.input = ctx.services.get(INPUT);
    this.assets = ctx.services.get(ASSETS);
    this.picker = ctx.services.get(PICKING);

    new DragSystem(this.picker, this.input);
    new SelectionSystem(this.picker, this.renderer);

    const texture: TextureHandle = await this.assets.loadTexture(
      "sealion",
      "assets/sealion.png",
    );

    const subRect: SpriteNode = this.renderer
      .createSprite("sealion2")
      .setTexture(texture)
      .setAnchor(0.5, 0.5)
      .setScale(0.1, 0.1)
      .setPosition(0, 0);

    const graphicRect: RectNode = this.renderer
      .createRect()
      .setFillColor(0xff0000)
      .setSize(100, 100)
      .setPosition(200, 0);

    this.rect = this.renderer
      .createSprite("sealion1")
      .setTexture(texture)
      .setAnchor(0.5, 0.5)
      .setScale(0.15, 0.15)
      .setAlpha(0.3);

    // this.renderer.root.add(this.rect);
    this.renderer.root.add(graphicRect);
    // this.rect.add(subRect);
    graphicRect.add(subRect);
  }

  public override onUpdate(dt: number): void {
    this.t += dt;

    if (this.input.isDown(Key.D)) {
      this.rect.position.add(Direction.Right);
    }

    if (this.input.isDown(Key.A)) {
      this.rect.position.add(Direction.Left);
    }

    if (this.input.isDown(Key.S)) {
      this.rect.position.add(Direction.Down);
    }

    if (this.input.isDown(Key.W)) {
      this.rect.position.add(Direction.Up);
    }

    if (this.input.isDown(Key.R)) {
      this.rect.rotation += 0.01;
    }

    if (this.input.isDown(Key.ArrowLeft)) {
      this.renderer.camera.position.add(Direction.Left);
    }

    if (this.input.isDown(Key.ArrowRight)) {
      this.renderer.camera.position.add(Direction.Right);
    }

    if (this.input.isDown(Key.ArrowDown)) {
      this.renderer.camera.position.add(Direction.Down);
    }

    if (this.input.isDown(Key.ArrowUp)) {
      this.renderer.camera.position.add(Direction.Up);
    }

    // if (this.input.isDown(Key.MouseLeft)) {
    //   const worldPosition: Vec2 = this.renderer.camera.screenToWorld(
    //     this.input.pointer.position,
    //   );

    //   const f: Vec2 = Vec2.from(worldPosition)
    //     .sub(this.rect.position)
    //     .mult(0.1);

    //   this.rect.position.add(f);
    // }

    if (this.input.pointer.wheelDelta !== 0) {
      const s: number = this.input.pointer.wheelDelta * 0.0005;
      this.renderer.camera.zoom += s;
    }
  }
}
