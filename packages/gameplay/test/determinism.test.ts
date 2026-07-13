import { describe, expect, it } from "vitest";

import { Engine, Plugin, ServiceToken } from "@atlasjs/core";
import { NEXUS, NexusPlugin, NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER } from "@atlasjs/nebula";
import { INERTIAL_ENGINE } from "@atlasjs/inertia";

import { GameplayPlugin } from "../src/GameplayPlugin";
import { SCRIPT_MANAGER } from "../src/tokens";
import { Transform2D } from "../src/components";
import { AtlasScript, ScriptManager } from "../src/scripting";

const FIXED = 0.1;

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
// No RigidBody2D on the test entity => the physics world is never called.
const fakeInertia = {};

class MoveScript extends AtlasScript {
  public onCreate(): void {
    this.addComponent(Transform2D);
  }
  public onFixedUpdate(): void {
    this.transform.translate(1, 0);
  }
}

async function runFixed(ticks: number): Promise<number> {
  let onTick: ((dt: number) => void) | null = null;

  const engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: ticks + 5,
    loop: (cb) => {
      onTick = cb;
      return () => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(new Provide("stub-nebula", NEBULA_RENDERER, fakeNebula));
  engine.use(new Provide("stub-inertia", INERTIAL_ENGINE, fakeInertia));
  engine.use(new GameplayPlugin());

  await engine.start();

  const world = engine.services.get<NexusWorld>(NEXUS);
  const scripts = engine.services.get<ScriptManager>(SCRIPT_MANAGER);

  const entity = world.createEntity();
  scripts.attach(entity, MoveScript);

  // One frame carrying `ticks` worth of accumulated time (+ half a step to
  // stay clear of floating-point boundary flakiness).
  onTick!(ticks * FIXED + FIXED * 0.5);

  const transform = world.getComponent(entity, Transform2D);
  return transform!.position.x;
}

// Runs `count` scripted entities through one frame of `ticks` fixed steps and
// returns each entity's resulting x. Each script drives its own Transform2D
// through the handle façade — verifies N>1 scripted entities all advance
// deterministically with no cross-talk.
async function runFixedMany(ticks: number, count: number): Promise<number[]> {
  let onTick: ((dt: number) => void) | null = null;

  const engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: ticks + 5,
    loop: (cb) => {
      onTick = cb;
      return () => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(new Provide("stub-nebula", NEBULA_RENDERER, fakeNebula));
  engine.use(new Provide("stub-inertia", INERTIAL_ENGINE, fakeInertia));
  engine.use(new GameplayPlugin());

  await engine.start();

  const world = engine.services.get<NexusWorld>(NEXUS);
  const scripts = engine.services.get<ScriptManager>(SCRIPT_MANAGER);

  const entities = Array.from({ length: count }, () => {
    const entity = world.createEntity();
    scripts.attach(entity, MoveScript);
    return entity;
  });

  onTick!(ticks * FIXED + FIXED * 0.5);

  return entities.map((e) => world.getComponent(e, Transform2D)!.position.x);
}

describe("Gameplay — fixed pipeline determinism", () => {
  it("advances every entity without skipping (cleanup via command buffer)", async () => {
    const xs = await runFixedMany(4, 5);
    expect(xs).toEqual([4, 4, 4, 4, 4]);
  });

  it("fires script onFixedUpdate every tick (bug #1) and advances the transform", async () => {
    const x = await runFixed(5);
    expect(x).toBe(5);
  });

  it("produces identical output for identical input across runs", async () => {
    const a = await runFixed(7);
    const b = await runFixed(7);
    expect(b).toBe(a);
    expect(a).toBe(7);
  });
});
