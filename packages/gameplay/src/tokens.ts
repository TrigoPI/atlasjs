import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import type { ScriptManager } from "./scripting";
import type { Instantiator } from "./prefab";

export const SCRIPT_MANAGER: ServiceToken<ScriptManager> =
  ServiceRegistry.createToken("SCRIPT_MANAGER");

export const INSTANTIATOR: ServiceToken<Instantiator> =
  ServiceRegistry.createToken("INSTANTIATOR");
