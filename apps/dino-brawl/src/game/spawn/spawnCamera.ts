import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import {
  type CameraManager,
  type ScriptManager,
  CAMERA_MANAGER,
  Camera,
  SCRIPT_MANAGER,
  Transform2D,
} from "@atlasjs/gameplay";

import { CameraFollowScript, CameraZoomScript } from "../scripts";

export function spawnCamera(ctx: SceneContext, target: Entity): Entity {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
  const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

  const cameraEntity: Entity = nexus.createEntity();
  nexus.addComponent(cameraEntity, Camera);
  nexus.addComponent(cameraEntity, Transform2D);

  scriptManager.attach(cameraEntity, CameraFollowScript, { target: target });
  scriptManager.attach(cameraEntity, CameraZoomScript, {});

  cameraManager.setActive(cameraEntity);

  return cameraEntity;
}
