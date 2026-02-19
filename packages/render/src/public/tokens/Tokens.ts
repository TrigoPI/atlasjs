import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { Renderer } from "../api";

export const RENDERER: ServiceToken<Renderer> =
  ServiceRegistry.createToken<Renderer>("ATLAS_RENDERER");
