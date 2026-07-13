import { Lane, Stage } from "./types";

export const FIXED_STAGES: readonly Stage[] = [
  { name: "PreSim", anchor: 100 },
  { name: "ScriptFixed", anchor: 150 },
  { name: "PhysicsRequest", anchor: 200 },
  { name: "PhysicsStep", anchor: 300 },
  { name: "PhysicsWriteback", anchor: 400 },
  { name: "Cleanup", anchor: 900 },
  { name: "Sync", anchor: 1000 },
] as const;

export const UPDATE_STAGES: readonly Stage[] = [
  { name: "Early", anchor: 200 },
  { name: "Logic", anchor: 300 },
  { name: "Editor", anchor: 700 },
  { name: "Late", anchor: 900 },
  { name: "Sync", anchor: 1000 },
] as const;

export const RENDER_STAGES: readonly Stage[] = [
  { name: "PreRender", anchor: 100 },
  { name: "Main", anchor: 200 },
  { name: "Overlays", anchor: 300 },
  { name: "Debug", anchor: 400 },
  { name: "Sync", anchor: 1000 },
] as const;

export const STAGES_BY_LANE: Readonly<Record<Lane, readonly Stage[]>> = {
  fixed: FIXED_STAGES,
  update: UPDATE_STAGES,
  render: RENDER_STAGES,
};
