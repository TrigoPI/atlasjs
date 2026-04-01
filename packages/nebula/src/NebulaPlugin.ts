import { Engine, Plugin, PRIORITY, Unsubscribe } from "@atlasjs/core";
import { Logger, createLogger } from "@atlasjs/utils";

import { Renderer } from "./core";
import { NebulaRenderer } from "./NebulaRenderer";
import { NEBULA_RENDERER } from "./tokens";

export class NebulaPlugin extends Plugin {
  private readonly renderer: Renderer;
  private readonly logger: Logger;

  private unsubscribe: Unsubscribe | null;

  public constructor(renderer: Renderer) {
    super("nebula-plugin");
    this.logger = createLogger();
    this.renderer = renderer;
    this.unsubscribe = null;
  }

  public async install(engine: Engine): Promise<void> {
    const renderer: NebulaRenderer = new NebulaRenderer(this.renderer);

    await renderer.init();

    engine.scheduler.onRender(() => renderer.render(), {
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
