import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { NEXUS } from "./token";
import { NexusWorld } from "./NexusWorld";

export class NexusPlugin extends Plugin {
  private readonly logger: Logger;
  private readonly world: NexusWorld;
  private handles: StepHandle[];

  public constructor() {
    super("nexus-plugin", { provides: [NEXUS] });
    this.logger = createLogger(NexusPlugin.name);
    this.world = new NexusWorld();
    this.handles = [];
  }

  public install(engine: Engine): void {
    this.logger.log("NexusPlugin installed.");

    engine.services.provide(NEXUS, this.world);

    const flush = (): void => this.world.flush();
    // prettier-ignore
    this.handles.push(
      engine.scheduler.fixed.add(flush, { name: "nexus:flush", stage: "Sync" }),
      engine.scheduler.update.add(flush, { name: "nexus:flush", stage: "Sync" }),
      engine.scheduler.render.add(flush, { name: "nexus:flush", stage: "Sync" }),
    );

    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling NexusPlugin.");
    for (const handle of this.handles) handle.remove();
    this.handles = [];
    this.world.destroy();
  }
}
