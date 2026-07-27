import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { SortingLayers } from "./SortingLayers";

export const SORTING_LAYERS: ServiceToken<SortingLayers> =
  ServiceRegistry.createToken("SORTING_LAYERS");
