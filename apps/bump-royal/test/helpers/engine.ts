import type { Engine, LoopFactory, StepSet, StopLoop } from "@atlasjs/core";
import { NEXUS } from "@atlasjs/nexus";
import type { NexusWorld } from "@atlasjs/nexus";
import { SCRIPT_MANAGER } from "@atlasjs/gameplay";
import type { ScriptManager } from "@atlasjs/gameplay";

import { createHeadlessEngine } from "../../src/server/createHeadlessEngine";

export const FIXED: number = 0.125;

const HARNESS_MAX_SUB_STEPS: number = 64;

export type GameHarness = {
  engine: Engine;
  world: NexusWorld;
  scripts: ScriptManager;
  scheduler: StepSet;
  fixedDelta: number;
  frame: (ticks?: number) => void;
  stop: () => void;
};

export type GameHarnessOptions = {
  fixedDelta?: number;
};

/* Deliberately the server's own plugin set, not a parallel one: every spec that boots this
   harness is therefore a spec about what src/server actually installs. Only the loop
   differs — the harness drives frames by hand instead of off a timer. */
export async function createGameHarness(
  options: GameHarnessOptions = {},
): Promise<GameHarness> {
  const fixedDelta: number = options.fixedDelta ?? FIXED;
  let onTick: ((dt: number) => void) | null = null;

  const loop: LoopFactory = (cb: (dt: number) => void): StopLoop => {
    onTick = cb;
    return (): void => {};
  };

  const engine: Engine = await createHeadlessEngine({
    fixedDelta,
    maxSubSteps: HARNESS_MAX_SUB_STEPS,
    loop,
  });

  const world: NexusWorld = engine.services.get(NEXUS);
  const scripts: ScriptManager = engine.services.get(SCRIPT_MANAGER);
  const scheduler: StepSet = engine.scheduler.createSet("test");

  return {
    engine,
    world,
    scripts,
    scheduler,
    fixedDelta,
    frame: (ticks: number = 1): void => {
      if (onTick === null) {
        throw new Error("engine loop was never started");
      }

      onTick(ticks * fixedDelta);
    },
    stop: (): void => engine.stop(),
  };
}
