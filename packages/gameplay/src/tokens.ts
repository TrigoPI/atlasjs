import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { ScriptManager } from "./scripting";

export const SCRIPT_MANAGER: ServiceToken<ScriptManager> =
  ServiceRegistry.createToken("SCRIPT_MANAGER");
