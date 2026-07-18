import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { AssetManager } from "./AssetManager";

export const ASSET_MANAGER: ServiceToken<AssetManager> =
  ServiceRegistry.createToken<AssetManager>("ASSET_MANAGER");
