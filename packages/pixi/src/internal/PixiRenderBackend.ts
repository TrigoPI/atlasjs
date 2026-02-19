import { RectStyle, RenderSurface } from "@atlasjs/render";
import { Application } from "pixi.js";

import { PixiContainerDriver, PixiRectDriver } from "./drivers";

import {
  IContainerDriver,
  IRectDriver,
  IRendererBackend,
} from "@atlasjs/render/backend";

export class PixiRendererBackend implements IRendererBackend {
  private app: Application | null;
  private rootDriver: PixiContainerDriver | null;

  public constructor() {
    this.app = null;
    this.rootDriver = null;
  }

  public root(): IContainerDriver {
    if (!this.rootDriver) {
      throw new Error("PixiRendererBackend not initialized");
    }

    return this.rootDriver;
  }

  public createContainer(): IContainerDriver {
    return new PixiContainerDriver();
  }

  public createRect(style: RectStyle): IRectDriver {
    return new PixiRectDriver(style);
  }

  public async init(surface: RenderSurface): Promise<void> {
    this.app = new Application();
    this.rootDriver = new PixiContainerDriver();

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
  }

  beginFrame(_dt: number): void {}
  endFrame(_dt: number): void {
    if (!this.app) return;
    this.app.renderer.render({ container: this.app.stage });
  }

  destroy(): void {
    this.rootDriver?.destroy();
    this.rootDriver = null;

    this.app?.destroy(true);
    this.app = null;
  }
}
