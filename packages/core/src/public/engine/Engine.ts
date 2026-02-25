import { createLogger, Logger } from "@atlasjs/utils";

import { Plugin } from "./Plugin";
import { EventBus } from "./EventBus";
import { Scheduler } from "./Scheduler";
import { ServiceRegistry } from "./ServiceRegistry";

import { startRafLoop } from "../../internal";
import { SceneContext, SceneManager } from "../scene";
import { EngineEvents, EngineOptions, StopLoop } from "./types";

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
  private acc: number;

  public constructor(opts: EngineOptions = {}) {
    this.logger = createLogger(Engine.name);

    this.events = new EventBus<EngineEvents>();
    this.services = new ServiceRegistry();
    this.scheduler = new Scheduler();
    this.scene = new SceneManager(this);

    this.plugins = [];

    this.fixedDelta = opts.fixedDelta ?? DEFAULT_FIXED_DELTA;
    this.maxSubSteps = opts.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS;

    this.acc = 0;
    this.booted = false;
    this.stopLoop = null;
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
    this.stopLoop = startRafLoop((dt) => {
      this.scene.update(dt);
      this.scheduler.runUpdate(dt);

      this.acc += dt;
      let steps: number = 0;

      while (this.acc >= this.fixedDelta && steps < this.maxSubSteps) {
        this.scheduler.runFixedUpdate(this.fixedDelta);
        this.acc -= this.fixedDelta;
        steps++;
      }

      this.scheduler.runRender(dt);
      this.scheduler.runEndFrame(dt);
    });
  }
}
