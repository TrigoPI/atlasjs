import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { PhysicsWorld } from "./PhysicsWorld";
import { INERTIAL_ENGINE } from "./token";

export class InertialPlugin extends Plugin {
  private readonly world: PhysicsWorld;
  private readonly logger: Logger;

  private stepHandle: StepHandle | null;

  public constructor(world: PhysicsWorld) {
    super("inertia-plugin", { provides: [INERTIAL_ENGINE] });
    this.world = world;
    this.stepHandle = null;
    this.logger = createLogger(InertialPlugin.name);
  }

  public async install(engine: Engine): Promise<void> {
    await this.world.init?.();

    this.stepHandle = engine.scheduler.fixed.add(
      (ctx) => this.world.step(ctx.dt),
      { name: "inertia:step", stage: "PhysicsStep" },
    );

    engine.services.provide(INERTIAL_ENGINE, this.world);

    this.logger.log("Inertial Plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling Inertial Plugin...");
    this.stepHandle?.remove();
    this.stepHandle = null;
    this.world.clear();
  }
}
