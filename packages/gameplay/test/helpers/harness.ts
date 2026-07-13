import { Engine, Plugin, ServiceToken } from "@atlasjs/core";
import { NEXUS, NexusPlugin, NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER } from "@atlasjs/nebula";
import { InertialPlugin } from "@atlasjs/inertia";

import { GameplayPlugin } from "../../src/GameplayPlugin";
import { SCRIPT_MANAGER } from "../../src/tokens";
import { ScriptManager } from "../../src/scripting";
import { FakePhysicsWorld } from "./fake-physics";

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

// The fixed lane never touches the renderer (SpriteRenderSystem runs in the
// render lane), so a minimal stub is enough to construct the systems.
const fakeNebula = { createSampler: () => ({}), scene: { addChild: () => {} } };

export interface Harness {
  world: NexusWorld;
  physics: FakePhysicsWorld;
  scripts: ScriptManager;
  /** Runs one frame carrying `ticks` fixed sub-steps (+ half a step of slack). */
  frame(ticks?: number): void;
}

export async function createHarness(): Promise<Harness> {
  let onTick: ((dt: number) => void) | null = null;

  const physics: FakePhysicsWorld = new FakePhysicsWorld();

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
  engine.use(new GameplayPlugin());

  await engine.start();

  const world = engine.services.get<NexusWorld>(NEXUS);
  const scripts = engine.services.get<ScriptManager>(SCRIPT_MANAGER);

  return {
    world,
    physics,
    scripts,
    frame: (ticks: number = 1): void => onTick!(ticks * FIXED + FIXED * 0.5),
  };
}
