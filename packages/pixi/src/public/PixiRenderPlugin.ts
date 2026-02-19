import { Engine, Plugin, Unsubscribe } from "@atlasjs/core";
import { RENDERER, Renderer, RenderSurface } from "@atlasjs/render";

import { PixiRenderPluginOptions } from "./types";

import {
  createSurface,
  observeSurfaceResize,
  PixiRendererBackend,
} from "../internal";

export class PixiRenderPlugin implements Plugin {
  public readonly id: string;
  public readonly order?: number | undefined;

  private readonly opts: PixiRenderPluginOptions;

  private backend: PixiRendererBackend | null;
  private stopResize: Unsubscribe | null = null;

  public constructor(opts: PixiRenderPluginOptions) {
    this.id = "pixi-render";
    this.order = 10;
    this.opts = opts;
    this.backend = null;
    this.stopResize = null;
  }

  public install(engine: Engine): void {
    const surface: RenderSurface = createSurface({
      mount: this.opts.mount ?? document.body,
      backgroundColor: this.opts.backgroundColor ?? 0x000000,
    });

    this.backend = new PixiRendererBackend();
    this.initAsync(engine, this.backend, surface);
  }

  public uninstall(): void {
    this.stopResize?.();
    this.stopResize = null;

    this.backend?.destroy();
    this.backend = null;
  }

  private async initAsync(
    engine: Engine,
    backend: PixiRendererBackend,
    surface: RenderSurface,
  ): Promise<void> {
    await backend.init(surface);
    const renderer: Renderer = new Renderer(backend);

    this.stopResize = observeSurfaceResize(surface, (w, h, dpr) => {
      backend.resize(w, h, dpr);
      renderer.events.emit("render:resize", { width: w, height: h, dpr });
    });

    backend.resize(surface.width, surface.height, surface.dpr);
    engine.scheduler.onRender((dt) => {
      renderer.flushDirtyTransform();
      backend.beginFrame(dt);
      backend.endFrame(dt);
    });

    engine.services.provide(RENDERER, renderer);

    renderer.events.emit("render:ready", {});
    engine.events.emit("render:ready", {});
  }
}
