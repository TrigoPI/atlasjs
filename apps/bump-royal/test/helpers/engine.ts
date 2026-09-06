import { Engine, Plugin } from "@atlasjs/core";
import type { ServiceToken, StepSet } from "@atlasjs/core";
import { NEXUS, NexusPlugin } from "@atlasjs/nexus";
import type { NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin, SCRIPT_MANAGER } from "@atlasjs/gameplay";
import type { ScriptManager } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";

export const FIXED: number = 0.125;

type StubNebula = {
  createSampler: () => object;
  scene: SceneGraph;
};

class Provide extends Plugin {
  private readonly token: ServiceToken<unknown>;
  private readonly value: unknown;

  public constructor(id: string, token: ServiceToken<unknown>, value: unknown) {
    super(id, { provides: [token] });
    this.token = token;
    this.value = value;
  }

  public install(engine: Engine): void {
    engine.services.provide(this.token, this.value);
    this.deferred.resolve();
  }

  public uninstall(): void {}
}

export type GameHarness = {
  engine: Engine;
  world: NexusWorld;
  scripts: ScriptManager;
  scheduler: StepSet;
  frame: (ticks?: number) => void;
  stop: () => void;
};

export async function createGameHarness(): Promise<GameHarness> {
  let onTick: ((dt: number) => void) | null = null;

  const nebula: StubNebula = {
    createSampler: (): object => ({}),
    scene: new SceneGraph(),
  };

  const physics: RapierPhysicsWorld = new RapierPhysicsWorld({
    unitsPerMeter: 100,
    gravity: new Vec2(0, 0),
  });

  const engine: Engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: 64,
    loop: (cb: (dt: number) => void): (() => void) => {
      onTick = cb;
      return (): void => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(new Provide("stub-nebula", NEBULA_RENDERER, nebula));
  engine.use(new InertialPlugin(physics));
  engine.use(new GameplayPlugin());

  await engine.start();

  const world: NexusWorld = engine.services.get(NEXUS);
  const scripts: ScriptManager = engine.services.get(SCRIPT_MANAGER);
  const scheduler: StepSet = engine.scheduler.createSet("test");

  return {
    engine,
    world,
    scripts,
    scheduler,
    frame: (ticks: number = 1): void => {
      if (onTick === null) {
        throw new Error("engine loop was never started");
      }

      onTick(ticks * FIXED);
    },
    stop: (): void => engine.stop(),
  };
}
