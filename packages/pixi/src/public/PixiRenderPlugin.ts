import { AssetManager, ASSETS } from "@atlasjs/assets";
import { Engine, Plugin, Unsubscribe } from "@atlasjs/core";
import { RENDERER, Renderer, RenderSurface } from "@atlasjs/render";
import { createLogger, Logger } from "@atlasjs/utils";

import { PixiRenderPluginOptions } from "./types";

import {
  createSurface,
  observeSurfaceResize,
  PixiRendererBackend,
  PixiTextureRegistry,
} from "../internal";

export class PixiRenderPlugin extends Plugin {
  private readonly logger: Logger;
  private readonly opts: PixiRenderPluginOptions;

  private backend: PixiRendererBackend | null;
  private stopResize: Unsubscribe | null = null;

  public constructor(opts: PixiRenderPluginOptions) {
    super("pixi-render", 10);
    this.logger = createLogger("log", PixiRenderPlugin.name);
    this.opts = opts;
    this.backend = null;
    this.stopResize = null;
  }

  public async install(engine: Engine): Promise<void> {
    this.logger.log("Installing PixiRenderPlugin...");

    const assets: AssetManager = await engine.services.wait(ASSETS);
    const textures: PixiTextureRegistry = new PixiTextureRegistry(assets);

    const surface: RenderSurface = createSurface({
      mount: this.opts.mount ?? document.body,
      backgroundColor: this.opts.backgroundColor ?? 0x000000,
    });

    this.logger.log(
      `Surface created : ${surface.width}x${surface.height} @ ${surface.dpr} DPR`,
    );

    this.backend = new PixiRendererBackend(textures);
    await this.initAsync(engine, this.backend, surface);

    this.deferred.resolve();
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
    this.logger.log("Initializing pixi...");
    await backend.init(surface);
    const renderer: Renderer = new Renderer(backend);

    this.stopResize = observeSurfaceResize(
      surface,
      (w: number, h: number, dpr: number) => {
        this.logger.log(`Surface resized : ${w}x${h} @ ${dpr} DPR`);
        backend.resize(w, h, dpr);
        renderer.setViewportSize(w, h);
        renderer.events.emit("render:resize", { width: w, height: h, dpr });
      },
    );

    backend.resize(surface.width, surface.height, surface.dpr);
    renderer.setViewportSize(surface.width, surface.height);

    engine.scheduler.onUpdate(() => {
      renderer.flushWorldTransforms();
      renderer.flushCamera();
    });

    engine.scheduler.onRender((dt: number) => {
      backend.beginFrame(dt);
      backend.endFrame(dt);
    });

    this.logger.log("Pixi initialized");
    engine.services.provide(RENDERER, renderer);

    renderer.events.emit("render:ready", {});
  }
}
