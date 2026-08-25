import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { Logger, createLogger } from "@atlasjs/utils";
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";

import { Renderer } from "./core";
import { NebulaRenderer } from "./NebulaRenderer";
import { NEBULA_RENDERER } from "./tokens";
import { SpriteLoader, TextureLoader, TileSetLoader } from "./assets";

export class NebulaPlugin extends Plugin {
  private readonly renderer: Renderer;
  private readonly logger: Logger;

  private renderStep: StepHandle | null;

  public constructor(renderer: Renderer) {
    super("nebula-plugin", {
      provides: [NEBULA_RENDERER],
      requires: [ASSET_MANAGER],
    });
    this.logger = createLogger(NebulaPlugin.name);
    this.renderer = renderer;
    this.renderStep = null;
  }

  public async install(engine: Engine): Promise<void> {
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);

    const renderer: NebulaRenderer = new NebulaRenderer(this.renderer);
    await renderer.init();

    assets.register(new TextureLoader(renderer));
    assets.register(new SpriteLoader());
    assets.register(new TileSetLoader());

    this.renderStep = engine.scheduler.render.add(() => renderer.render(), {
      name: "nebula:render",
      stage: "Main",
    });

    engine.services.provide(NEBULA_RENDERER, renderer);

    this.logger.log("Nebula Plugin installed");
    this.deferred.resolve();
  }

  public async uninstall(): Promise<void> {
    this.logger.log("Uninstalling Nebula Plugin...");
    this.renderStep?.remove();
    this.renderStep = null;
    this.renderer.destroy();
  }
}
