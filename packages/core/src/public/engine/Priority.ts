export const PRIORITY = {
  PRE_UPDATE: 100, // nebula flush transforms/camera
  UPDATE_PICKING: 200, // picker
  UPDATE_EDITOR: 300, // selection/gizmo (met à jour overlay nodes)
  UPDATE_CMD_BUILD: 400, // sceneRenderer.onSync() traverse/build cmds
  UPDATE_INPUT_END: 900, // input.endFrame
  RENDER_MAIN: 100,
} as const;
