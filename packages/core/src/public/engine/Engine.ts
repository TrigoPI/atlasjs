import { createLogger, Logger } from "@atlasjs/utils";

import { Plugin } from "./Plugin";
import { EventBus } from "./EventBus";
import { Scheduler } from "./Scheduler";
import { ServiceRegistry } from "./ServiceRegistry";

import { FrameClock, startRafLoop } from "../../private";
import { SceneContext, SceneManager } from "../scene";
import {
  EngineEvents,
  EngineOptions,
  LoopFactory,
  StepContext,
  StopLoop,
} from "./types";

const DEFAULT_FIXED_DELTA = 1 / 60;
const DEFAULT_MAX_SUB_STEPS = 5;

export class Engine implements SceneContext {
  private readonly logger: Logger;

  public readonly events: EventBus<EngineEvents>;
  public readonly services: ServiceRegistry;
  public readonly scheduler: Scheduler;
  public readonly scene: SceneManager;

  private plugins: Plugin[];
  private stopLoop: StopLoop | null;

  private fixedDelta: number;
  private maxSubSteps: number;

  private booted: boolean;
  private readonly clock: FrameClock;
  private readonly loopFactory: LoopFactory;

  public constructor(opts: EngineOptions = {}) {
    this.logger = createLogger(Engine.name);

    this.events = new EventBus<EngineEvents>();
    this.services = new ServiceRegistry();
    this.scheduler = new Scheduler();
    this.scene = new SceneManager(this);

    this.plugins = [];

    this.fixedDelta = opts.fixedDelta ?? DEFAULT_FIXED_DELTA;
    this.maxSubSteps = opts.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS;

    this.clock = new FrameClock();
    this.loopFactory = opts.loop ?? startRafLoop;
    this.booted = false;
    this.stopLoop = null;

    this.scheduler.update.add((ctx: StepContext) => this.scene.update(ctx.dt), {
      name: "scene:update",
      stage: "Early",
    });
  }

  public isBooted(): boolean {
    return this.booted;
  }

  public use(plugin: Plugin): Engine {
    if (this.stopLoop) {
      throw new Error("Cannot install plugin while engine is running");
    }

    this.plugins.push(plugin);
    return this;
  }

  public async start(): Promise<void> {
    if (this.stopLoop) return;
    await this.boot();
  }

  public stop(): void {
    if (!this.stopLoop) {
      return;
    }

    this.stopLoop();
    this.stopLoop = null;

    for (let i = this.plugins.length - 1; i >= 0; i--) {
      this.plugins[i].uninstall?.(this);
    }

    this.events.emit("engine:stop", {});
    this.events.clear();
  }

  private async boot(): Promise<void> {
    this.logger.log("Booting engine...");

    this.plugins.sort(
      (a: Plugin, b: Plugin) => (a.order ?? 0) - (b.order ?? 0),
    );

    for (const p of this.plugins) {
      this.logger.log(`Installing plugin: ${p.constructor.name}`);
      p.install(this);
    }

    await Promise.all(this.plugins.map((p: Plugin) => p.deferred.ready));
    this.logger.log("All plugins are ready");

    this.events.emit("engine:start", {});
    this.booted = true;
    this.startLoop();
  }

  private startLoop(): void {
    this.stopLoop = this.loopFactory((dt) => {
      this.clock.acc += dt;
      this.clock.elapsed += dt;

      this.advanceFixed(this.maxSubSteps);
      this.scheduler.runLane("update", this.clock.context(dt, 1));

      this.clock.frame++;
      const alpha: number = this.clock.acc / this.fixedDelta;
      this.scheduler.runLane("render", this.clock.context(dt, alpha));
    });
  }

  public advanceFixed(maxSteps: number): void {
    let steps: number = 0;

    while (this.clock.acc >= this.fixedDelta && steps < maxSteps) {
      this.clock.tick++;
      this.scheduler.runLane("fixed", this.clock.context(this.fixedDelta, 1));
      this.clock.acc -= this.fixedDelta;
      steps++;
    }
  }
}
