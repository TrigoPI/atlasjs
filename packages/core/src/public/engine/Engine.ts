import { createLogger, Logger } from "@atlasjs/utils";

import { Plugin } from "./Plugin";
import { EventBus } from "./EventBus";
import { Scheduler } from "./Scheduler";
import { ServiceRegistry } from "./ServiceRegistry";
import { FrameClock, startRafLoop } from "../../private";
import { SceneContext, SceneManager } from "../scene";

import {
  BootTimeoutError,
  DependencyCycleError,
  DuplicateProviderError,
  MissingDependencyError,
} from "./PluginErrors";

import {
  EngineEvents,
  EngineOptions,
  LoopFactory,
  ServiceToken,
  StepContext,
  StopLoop,
} from "./types";

const DEFAULT_FIXED_DELTA = 1 / 60;
const DEFAULT_MAX_SUB_STEPS = 5;
const DEFAULT_BOOT_TIMEOUT = 10_000;

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
  private readonly bootTimeout: number;

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
    this.bootTimeout = opts.bootTimeout ?? DEFAULT_BOOT_TIMEOUT;
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

    const order: Plugin[] = this.resolveInstallOrder();

    const installs: Promise<void>[] = order.map((p: Plugin) => {
      this.logger.log(`Installing plugin: ${p.constructor.name}`);
      return Promise.resolve(p.install(this));
    });

    await this.awaitReady(order, installs);
    this.assertProvidesResolved(order);
    this.logger.log("All plugins are ready");

    this.events.emit("engine:start", {});
    this.booted = true;
    this.startLoop();
  }

  private resolveInstallOrder(): Plugin[] {
    const providerOf: Map<ServiceToken<unknown>, Plugin> = new Map();

    for (const plugin of this.plugins) {
      for (const token of plugin.provides) {
        const existing: Plugin | undefined = providerOf.get(token);
        if (existing) {
          throw new DuplicateProviderError(token, existing.id, plugin.id);
        }
        providerOf.set(token, plugin);
      }
    }

    const adjacency: Map<Plugin, Plugin[]> = new Map();
    const indegree: Map<Plugin, number> = new Map();
    for (const plugin of this.plugins) {
      adjacency.set(plugin, []);
      indegree.set(plugin, 0);
    }

    for (const plugin of this.plugins) {
      for (const token of plugin.requires) {
        const provider: Plugin | undefined = providerOf.get(token);
        if (!provider) {
          throw new MissingDependencyError(token, plugin.id);
        }
        if (provider === plugin) continue;
        adjacency.get(provider)!.push(plugin);
        indegree.set(plugin, indegree.get(plugin)! + 1);
      }
    }

    // Kahn's algorithm, seeded in registration order for a stable result.
    const ordered: Plugin[] = [];
    const queue: Plugin[] = this.plugins.filter(
      (p: Plugin) => indegree.get(p) === 0,
    );

    while (queue.length > 0) {
      const plugin: Plugin = queue.shift()!;
      ordered.push(plugin);

      for (const consumer of adjacency.get(plugin)!) {
        const deg: number = indegree.get(consumer)! - 1;
        indegree.set(consumer, deg);
        if (deg === 0) queue.push(consumer);
      }
    }

    if (ordered.length !== this.plugins.length) {
      const cyclic: string[] = this.plugins
        .filter((p: Plugin) => !ordered.includes(p))
        .map((p: Plugin) => p.id);
      throw new DependencyCycleError(cyclic);
    }

    return ordered;
  }

  private async awaitReady(
    order: Plugin[],
    installs: Promise<void>[],
  ): Promise<void> {
    const resolved: Set<string> = new Set();
    const readies: Promise<void>[] = order.map((p: Plugin) =>
      p.deferred.ready.then(() => {
        resolved.add(p.id);
      }),
    );

    const ready: Promise<void> = Promise.all([...installs, ...readies]).then(
      () => undefined,
    );

    let timer: ReturnType<typeof setTimeout>;
    const timeout: Promise<never> = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const pending: string[] = order
          .filter((p: Plugin) => !resolved.has(p.id))
          .map((p: Plugin) => p.id);
        reject(new BootTimeoutError(pending, this.bootTimeout));
      }, this.bootTimeout);
    });

    try {
      await Promise.race([ready, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private assertProvidesResolved(order: Plugin[]): void {
    for (const plugin of order) {
      for (const token of plugin.provides) {
        if (!this.services.has(token)) {
          throw new Error(
            `Plugin "${plugin.id}" declared it provides ${String(token)} but never provided it during install.`,
          );
        }
      }
    }
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
