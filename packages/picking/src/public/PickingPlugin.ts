import { Engine, Plugin } from "@atlasjs/core";
import { INPUT, Input } from "@atlasjs/input";
import { Renderer, RENDERER } from "@atlasjs/render";
import { createLogger, Logger } from "@atlasjs/utils";

import { Picker } from "./Picker";
import { PICKING } from "./Tokens";

export class PickingPlugin extends Plugin {
  private readonly logger: Logger;

  public constructor() {
    super("picking");
    this.logger = createLogger("log", PickingPlugin.name);
  }

  public async install(engine: Engine): Promise<void> {
    this.logger.log("Installing picking plugin...");

    const renderer: Renderer = await engine.services.wait(RENDERER);
    const input: Input = await engine.services.wait(INPUT);

    const picker: Picker = new Picker(renderer.root, renderer.camera, input);

    engine.services.provide(PICKING, picker);
    engine.scheduler.onUpdate(() => {
      picker.onUpdate();
    });

    this.logger.log("Picking plugin installed");
    this.deferred.resolve();
  }

  public uninstall(engine: Engine): void {}
}
