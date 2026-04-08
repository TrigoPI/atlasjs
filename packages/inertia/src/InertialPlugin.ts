import { Engine, Plugin, PRIORITY } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { PhysicsWorld } from "./PhysicsWorld";
import { INERTIAL_ENGINE } from "./token";

export class InertialPlugin extends Plugin {
  private readonly world: PhysicsWorld;
  private readonly logger: Logger;

  public constructor(world: PhysicsWorld) {
    super("inertia-plungin");
    this.world = world;
    this.logger = createLogger(InertialPlugin.name);
  }

  public async install(engine: Engine): Promise<void> {
    await this.world.init?.();

    engine.scheduler.onFixedUpdate(() => this.world.step(), {
      name: "inertia:step",
      priority: PRIORITY.PRE_UPDATE,
    });

    engine.services.provide(INERTIAL_ENGINE, this.world);
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling Inertial Plugin...");
    this.world.clear();
  }
}
