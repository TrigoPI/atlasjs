export const PRIORITY = {
  // ---------------------------------------------------------------------------
  // UPDATE LANE
  // ---------------------------------------------------------------------------

  UPDATE_INPUT_BEGIN: 100,
  UPDATE_SPAWN: 200,
  UPDATE_ECS: 300,
  UPDATE_PICKING: 600,
  UPDATE_EDITOR: 700,
  UPDATE_CLEANUP: 800,
  UPDATE_INPUT_END: 900,

  // ---------------------------------------------------------------------------
  // FIXED UPDATE LANE
  // ---------------------------------------------------------------------------

  FIXED_PREPARE: 100,
  FIXED_ECS: 200,
  FIXED_PHYSICS_STEP: 300,
  FIXED_PHYSICS_SYNC: 400,
  FIXED_CLEANUP: 900,

  // ---------------------------------------------------------------------------
  // RENDER LANE
  // ---------------------------------------------------------------------------

  RENDER_PREPARE: 100,
  RENDER_MAIN: 200,
  RENDER_OVERLAYS: 300,
  RENDER_DEBUG: 400,
} as const;
