import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, PRIORITY, Unsubscribe } from "@atlasjs/core";

import { NebulaPluginOptions } from "./types";
import { NebulaRenderer } from "./NebulaRenderer";
import { NEBULA_RENDERER } from "./tokens";

import {
  createSurface,
  observeSurfaceResize,
  Renderer,
  RenderingSurface,
} from "@atlasjs/renderer";

export class NebulaPlugin extends Plugin {
  private readonly renderer: Renderer;
  private readonly options: NebulaPluginOptions;
  private readonly logger: Logger;

  private unsubscribe: Unsubscribe | null;

  public constructor(renderer: Renderer, options: NebulaPluginOptions) {
    super("nebula-plugin");
    this.logger = createLogger();
    this.renderer = renderer;
    this.options = options;
    this.unsubscribe = null;
  }

  public async install(engine: Engine): Promise<void> {
    const renderer: NebulaRenderer = new NebulaRenderer(this.renderer);
    const surface: RenderingSurface = createSurface(
      this.options.mount,
      this.options.background,
    );

    this.logger.log(`Surface created : ${surface.width}x${surface.height}`);
    await this.renderer.init(surface);

    this.unsubscribe = observeSurfaceResize(
      surface,
      (width: number, height: number): void => {
        this.logger.log(`Surface resized : ${width}x${height}`);
        renderer.setViewportSize(width, height);
      },
    );

    engine.scheduler.onUpdate(() => renderer.onFlush(), {
      name: "nebula:flush",
      priority: PRIORITY.PRE_UPDATE,
    });

    engine.scheduler.onUpdate(() => renderer.onSync(), {
      name: "nebula:sync",
      priority: PRIORITY.UPDATE_CMD_BUILD,
    });

    engine.scheduler.onRender(() => renderer.onRender(), {
      name: "nebula:render",
      priority: PRIORITY.RENDER_MAIN,
    });

    engine.services.provide(NEBULA_RENDERER, renderer);
    this.deferred.resolve();
  }

  public async uninstall(): Promise<void> {
    this.logger.log("Uninstalling Nebula Plugin...");
    this.renderer.destroy();
    this.unsubscribe?.();
  }
}
