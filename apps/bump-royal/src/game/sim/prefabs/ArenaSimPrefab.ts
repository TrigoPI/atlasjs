import {
  definePrefab,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

import { buildArenaSim } from "./buildArenaSim";

export const createArenaSimPrefab = (): Prefab<void> =>
  definePrefab<void>({
    name: "arena-sim",
    build: (entity: EntityBuilder): void => {
      buildArenaSim(entity);
    },
  });
