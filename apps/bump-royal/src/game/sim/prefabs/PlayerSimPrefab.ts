import {
  definePrefab,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

import { buildPlayerSim, type PlayerSimProps } from "./buildPlayerSim";

export const createPlayerSimPrefab = (): Prefab<PlayerSimProps> =>
  definePrefab<PlayerSimProps>({
    name: "player-sim",
    build: (entity: EntityBuilder, props: PlayerSimProps): void => {
      buildPlayerSim(entity, props);
    },
  });
