import { Engine, Plugin } from "@atlasjs/core";
import type { LoopFactory, ServiceToken } from "@atlasjs/core";
import { NexusPlugin } from "@atlasjs/nexus";
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";

export const SERVER_FIXED_DELTA: number = 1 / 60;
export const SERVER_MAX_SUB_STEPS: number = 5;

const UNITS_PER_METER: number = 100;

type StubNebula = {
  createSampler: () => object;
  scene: SceneGraph;
};

class ProvideStub extends Plugin {
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

/* `loop` is required: Engine falls back to startRafLoop, and requestAnimationFrame does not
   exist in Node. An optional field here would turn a forgotten argument into a boot crash. */
export type HeadlessEngineOptions = {
  loop: LoopFactory;
  fixedDelta?: number;
  maxSubSteps?: number;
};

/* No AssetPlugin, no AudioPlugin and no InputPlugin, by measurement rather than by hope:
   AudioSystem resolves AUDIO_ENGINE only when an AudioSource takes a play command, and
   PlayerInputSystem resolves INPUT inside its query callback — with no PlayerInput
   component in the world that callback never runs. buildPlayerSim adds none. */
export async function createHeadlessEngine(
  options: HeadlessEngineOptions,
): Promise<Engine> {
  const nebula: StubNebula = {
    createSampler: (): object => ({}),
    scene: new SceneGraph(),
  };

  const physics: RapierPhysicsWorld = new RapierPhysicsWorld({
    unitsPerMeter: UNITS_PER_METER,
    gravity: new Vec2(0, 0),
  });

  const engine: Engine = new Engine({
    fixedDelta: options.fixedDelta ?? SERVER_FIXED_DELTA,
    maxSubSteps: options.maxSubSteps ?? SERVER_MAX_SUB_STEPS,
    loop: options.loop,
  });

  engine.use(new NexusPlugin());
  engine.use(new ProvideStub("stub-nebula", NEBULA_RENDERER, nebula));
  engine.use(new InertialPlugin(physics));
  engine.use(new GameplayPlugin());

  await engine.start();

  return engine;
}
