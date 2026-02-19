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
  public readonly events: EventBus<EngineEvents>;
  public readonly services: ServiceRegistry;
  public readonly scheduler: Scheduler;
  public readonly scene: SceneManager;

  private plugins: Plugin[];
  private stopLoop: StopLoop | null;

  private fixedDelta: number;
  private maxSubSteps: number;

  private acc: number;

  public constructor(opts: EngineOptions = {}) {
    this.events = new EventBus<EngineEvents>();
    this.services = new ServiceRegistry();
    this.scheduler = new Scheduler();
    this.scene = new SceneManager(this);

    this.plugins = [];

    this.fixedDelta = opts.fixedDelta ?? DEFAULT_FIXED_DELTA;
    this.maxSubSteps = opts.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS;

    this.acc = 0;
    this.stopLoop = null;
  }

  public use(plugin: Plugin): Engine {
    if (this.stopLoop) {
      throw new Error("Cannot install plugin while engine is running");
    }

    this.plugins.push(plugin);
    return this;
  }

  public start(): void {
    if (this.stopLoop) {
      return;
    }

    this.installPlugins();
    this.events.emit("engine:start", {});
    this.startLoop();
  }

  stop(): void {
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

  private installPlugins(): void {
    this.plugins.sort(
      (a: Plugin, b: Plugin) => (a.order ?? 0) - (b.order ?? 0),
    );

    for (const p of this.plugins) {
      p.install(this);
    }
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
    });
  }
}
