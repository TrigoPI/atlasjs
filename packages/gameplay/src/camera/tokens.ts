import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { CameraManager } from "./CameraManager";

export const CAMERA_MANAGER: ServiceToken<CameraManager> =
  ServiceRegistry.createToken("CAMERA_MANAGER");
