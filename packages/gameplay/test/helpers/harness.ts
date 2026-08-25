import { Engine, Plugin, ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { NEXUS, NexusPlugin, NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";
import { InertialPlugin } from "@atlasjs/inertia";
import { AssetPlugin } from "@atlasjs/assets";
import { AUDIO_ENGINE, AudioEngine } from "@atlasjs/audio";

import { GameplayPlugin } from "../../src/GameplayPlugin";
import { SCRIPT_MANAGER } from "../../src/tokens";
import { ScriptManager } from "../../src/scripting";
import { FakePhysicsWorld } from "./fake-physics";
import { FakeAudioEngine } from "./fake-audio";

export const FIXED = 0.1;

/** Provides a stub value under a token so GameplayPlugin's deps resolve. */
class Provide extends Plugin {
  public constructor(
    id: string,
    private readonly token: ServiceToken<unknown>,
    private readonly value: unknown,
  ) {
    super(id, { provides: [token] });
  }
  public install(engine: Engine): void {
    engine.services.provide(this.token, this.value);
    this.deferred.resolve();
  }
  public uninstall(): void {}
}

export interface HarnessOptions {
  audio?: boolean;
}

export interface Harness {
  world: NexusWorld;
  physics: FakePhysicsWorld;
  audio: FakeAudioEngine;
  scripts: ScriptManager;
  services: ServiceRegistry;
  /** Runs one frame carrying `ticks` fixed sub-steps (+ half a step of slack). */
  frame(ticks?: number): void;
}

export async function createHarness(
  options?: HarnessOptions,
): Promise<Harness> {
  let onTick: ((dt: number) => void) | null = null;
  const provideAudio: boolean = options?.audio ?? true;

  const physics: FakePhysicsWorld = new FakePhysicsWorld();
  const audio: FakeAudioEngine = new FakeAudioEngine();

  // A per-harness stub renderer with a real scene so tests observe mounts.
  const fakeNebula = { createSampler: () => ({}), scene: new SceneGraph() };

  const engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: 64,
    loop: (cb) => {
      onTick = cb;
      return () => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(new Provide("stub-nebula", NEBULA_RENDERER, fakeNebula));
  engine.use(new InertialPlugin(physics));
  engine.use(new AssetPlugin());
  if (provideAudio) {
    engine.use(
      new Provide("stub-audio", AUDIO_ENGINE, audio as unknown as AudioEngine),
    );
  }
  engine.use(new GameplayPlugin());

  await engine.start();

  const world = engine.services.get<NexusWorld>(NEXUS);
  const scripts = engine.services.get<ScriptManager>(SCRIPT_MANAGER);

  return {
    world,
    physics,
    audio,
    scripts,
    services: engine.services,
    frame: (ticks: number = 1): void => onTick!(ticks * FIXED + FIXED * 0.5),
  };
}
