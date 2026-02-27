import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { NebulaRenderer } from "./NebulaRenderer";

export const NEBULA_RENDERER: ServiceToken<NebulaRenderer> =
  ServiceRegistry.createToken<NebulaRenderer>("NEBULA_RENDERER");
