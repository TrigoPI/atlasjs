import { Application } from "pixi.js";
import { RectStyle, RenderSurface } from "@atlasjs/render";
import { Box2 } from "@atlasjs/math";

import { PixiTextureRegistry } from "./PixiTextureRegistry";

import {
  PixiCameraDriver,
  PixiContainerDriver,
  PixiRectDriver,
  PixiSpriteDriver,
} from "./drivers";

import {
  ICameraDriver,
  IContainerDriver,
  IRectDriver,
  IRendererBackend,
  ISpriteDriver,
} from "@atlasjs/render/backend";

export class PixiRendererBackend implements IRendererBackend {
  private app: Application | null;
  private rootDriver: PixiContainerDriver;
  private textures: PixiTextureRegistry;
  private camera: PixiCameraDriver;

  public constructor(textures: PixiTextureRegistry) {
    this.app = null;
    this.textures = textures;
    this.rootDriver = new PixiContainerDriver();
    this.camera = new PixiCameraDriver(this.rootDriver.obj);
  }

  public getCamera(): ICameraDriver {
    return this.camera;
  }

  public root(): IContainerDriver {
    if (!this.rootDriver) {
      throw new Error("PixiRendererBackend not initialized");
    }

    return this.rootDriver;
  }

  public getSurfaceSize(): Box2 {
    return Box2.create(
      this.app?.renderer.width ?? 0,
      this.app?.renderer.height ?? 0,
    );
  }

  public createContainer(): IContainerDriver {
    return new PixiContainerDriver();
  }

  public createRect(style: RectStyle): IRectDriver {
    return new PixiRectDriver(style);
  }

  public createSprite(): ISpriteDriver {
    return new PixiSpriteDriver(this.textures);
  }

  public async init(surface: RenderSurface): Promise<void> {
    this.app = new Application();

    await this.app.init({
      canvas: surface.canvas,
      width: surface.width,
      height: surface.height,
      resolution: surface.dpr,
      backgroundColor: surface.backgroundColor,
    });

    this.app.ticker.stop();
    this.app.stage.addChild(this.rootDriver.obj);
  }

  public resize(width: number, height: number, dpr: number): void {
    if (!this.app) {
      return;
    }

    this.app.renderer.resolution = dpr;
    this.app.renderer.resize(width, height, dpr);
    this.app.canvas.style.width = `${width}px`;
    this.app.canvas.style.height = `${height}px`;
  }

  public beginFrame(_dt: number): void {}
  public endFrame(_dt: number): void {
    if (!this.app) return;
    this.app.renderer.render({ container: this.app.stage });
  }

  public destroy(): void {
    this.rootDriver.destroy();
    this.app?.destroy(true);
    this.app = null;
  }
}
