import { AtlasMapper } from "../private";
import { PixiTextureResolver } from "./PixiTextureResolver";
import { GraphicsPool, SpritePool } from "./pool";

import {
  CommandBuffer,
  DrawRectCmd,
  DrawSpriteCmd,
  Renderer,
  RenderingSurface,
  ViewState,
} from "@atlasjs/nebula";

import {
  Application,
  Container,
  Graphics,
  Matrix,
  Sprite,
  Texture,
} from "pixi.js";

export class PixiRenderer implements Renderer {
  private readonly app: Application;
  private readonly worldRoot: Container;
  private readonly sceneLayer: Container;

  private readonly spritePool: SpritePool;
  private readonly graphicsPool: GraphicsPool;

  private readonly textureResolver: PixiTextureResolver;
  private readonly tmpMatrix: Matrix;

  public constructor() {
    this.app = new Application();
    this.tmpMatrix = new Matrix();
    this.worldRoot = new Container();
    this.sceneLayer = new Container();
    this.spritePool = new SpritePool(this.sceneLayer);
    this.graphicsPool = new GraphicsPool(this.sceneLayer);
    this.textureResolver = new PixiTextureResolver();
  }

  public async init(surface: RenderingSurface): Promise<void> {
    await this.app.init({
      canvas: surface.canvas,
      width: surface.width,
      height: surface.height,
      background: surface.background ?? 0x000000,
      autoStart: false,
      antialias: true,
    });

    this.worldRoot.addChild(this.sceneLayer);
    this.app.stage.addChild(this.worldRoot);
  }

  public destroy(): void {
    this.app.destroy({ releaseGlobalResources: true, removeView: true });
  }

  public beginFrame(): void {
    this.spritePool.beginFrame();
    this.graphicsPool.beginFrame();
  }

  public setView(view: ViewState): void {
    AtlasMapper.mat2ToPixiMatrix(view.view, this.tmpMatrix);
    this.worldRoot.setFromMatrix(this.tmpMatrix);
  }

  public submit(cmds: CommandBuffer): void {
    this.drawRect(cmds.rects);
    this.drawSprite(cmds.sprites);
  }

  public endFrame(): void {
    this.app.render();
    this.spritePool.endFrame();
    this.graphicsPool.endFrame();
  }

  public resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.app.canvas.style.width = `${width}px`;
    this.app.canvas.style.height = `${height}px`;
  }

  private drawRect(rects: DrawRectCmd[]): void {
    for (let i = 0; i < rects.length; i++) {
      const cmd: DrawRectCmd = rects[i];
      const g: Graphics = this.graphicsPool.acquire();
      const hw: number = cmd.width * 0.5;
      const hh: number = cmd.height * 0.5;

      AtlasMapper.mat2ToPixiMatrix(cmd.world, this.tmpMatrix);

      g.clear();
      g.setFromMatrix(this.tmpMatrix);
      g.rect(-hw, -hh, cmd.width, cmd.height);

      g.stroke({
        width: cmd.stroke.width,
        color: cmd.stroke.color,
        alpha: cmd.stroke.alpha ?? 1,
      });

      g.fill({
        color: cmd.fill.color,
        alpha: cmd.fill.alpha ?? 1,
      });

      this.sceneLayer.addChild(g);
    }
  }

  private drawSprite(sprites: DrawSpriteCmd[]): void {
    for (let i = 0; i < sprites.length; i++) {
      const cmd: DrawSpriteCmd = sprites[i];
      const s: Sprite = this.spritePool.acquire();
      const tex: Texture = this.textureResolver.resolve(cmd.texture);

      s.texture = tex;
      s.alpha = cmd.alpha ?? 1;
      s.anchor.set(0.5, 0.5);

      AtlasMapper.mat2ToPixiMatrix(cmd.world, this.tmpMatrix);
      s.setFromMatrix(this.tmpMatrix);
      this.sceneLayer.addChild(s);
    }
  }
}
