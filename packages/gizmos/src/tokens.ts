import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { Gizmos } from "./Gizmos";

export const GIZMOS: ServiceToken<Gizmos> =
  ServiceRegistry.createToken<Gizmos>("GIZMOS");
