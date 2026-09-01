import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import {
  type CameraManager,
  CAMERA_MANAGER,
  Camera,
  Transform2D,
} from "@atlasjs/gameplay";

export function spawnCamera(ctx: SceneContext): Entity {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

  const cameraEntity: Entity = nexus.createEntity();
  nexus.addComponent(cameraEntity, Camera);
  nexus.addComponent(cameraEntity, Transform2D);

  cameraManager.setActive(cameraEntity);

  return cameraEntity;
}
