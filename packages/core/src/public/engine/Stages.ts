import { Lane, Stage } from "./types";

// ---------------------------------------------------------------------------
// Stage vocabulary. Each lane owns a fixed, ordered list of named stages.
// Coarse ordering comes from the stage order; fine ordering from before/after.
//
// The numeric `anchor` places a stage on the shared ordering axis. Anchors are
// intentionally aligned with the legacy PRIORITY bands (Priority.ts) so that,
// during migration, legacy numeric steps and staged steps interleave in a
// predictable way (a legacy step at priority 300 lands between stages anchored
// at 200 and 400).
// ---------------------------------------------------------------------------

export const FIXED_STAGES: readonly Stage[] = [
  { name: "PreSim", anchor: 100 },
  { name: "ScriptFixed", anchor: 150 },
  { name: "PhysicsRequest", anchor: 200 },
  { name: "PhysicsStep", anchor: 300 },
  { name: "PhysicsWriteback", anchor: 400 },
  { name: "Cleanup", anchor: 900 },
] as const;

export const UPDATE_STAGES: readonly Stage[] = [
  { name: "Early", anchor: 200 },
  { name: "Logic", anchor: 300 },
  { name: "Editor", anchor: 700 },
] as const;

export const RENDER_STAGES: readonly Stage[] = [
  { name: "PreRender", anchor: 100 },
  { name: "Main", anchor: 200 },
  { name: "Overlays", anchor: 300 },
  { name: "Debug", anchor: 400 },
] as const;

export const STAGES_BY_LANE: Readonly<Record<Lane, readonly Stage[]>> = {
  fixed: FIXED_STAGES,
  update: UPDATE_STAGES,
  render: RENDER_STAGES,
};
