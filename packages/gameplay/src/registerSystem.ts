import { LaneScheduler, StepHandle, StepSpec } from "@atlasjs/core";
import { NexusSystem, NexusWorld } from "@atlasjs/nexus";

export function registerSystem(
  lane: LaneScheduler,
  world: NexusWorld,
  system: NexusSystem,
  spec: StepSpec,
): StepHandle {
  return lane.add((ctx) => system.update({ world, dt: ctx.dt }), spec);
}
