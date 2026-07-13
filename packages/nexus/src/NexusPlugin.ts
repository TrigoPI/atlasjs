import { Engine, Plugin } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { NEXUS } from "./token";
import { NexusWorld } from "./NexusWorld";

export class NexusPlugin extends Plugin {
  private readonly logger: Logger;
  private readonly world: NexusWorld;

  public constructor() {
    super("nexus-plugin", { provides: [NEXUS] });
    this.logger = createLogger(NexusPlugin.name);
    this.world = new NexusWorld();
  }

  public install(engine: Engine): void {
    this.logger.log("NexusPlugin installed.");

    engine.services.provide(NEXUS, this.world);
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling NexusPlugin.");
    this.world.destroy();
  }
}
