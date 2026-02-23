import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import type { AssetManager } from "./AssetManager";

export const ASSETS: ServiceToken<AssetManager> =
  ServiceRegistry.createToken<AssetManager>("ALTAS_ASSETS");
