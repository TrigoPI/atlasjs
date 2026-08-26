import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import type { TimeScaleManager } from "./TimeScaleManager";

export const TIME_SCALE_MANAGER: ServiceToken<TimeScaleManager> =
  ServiceRegistry.createToken("TIME_SCALE_MANAGER");
