import {
  definePrefab,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

import type { NetId } from "../../../net/protocol";
import { NetPlayer } from "../NetPlayer";

import { buildPlayerSim, type PlayerSimProps } from "./buildPlayerSim";

export type NetPlayerSimProps = PlayerSimProps & {
  netId: NetId;
};

export const createNetPlayerSimPrefab = (): Prefab<NetPlayerSimProps> =>
  definePrefab<NetPlayerSimProps>({
    name: "net-player-sim",
    build: (entity: EntityBuilder, props: NetPlayerSimProps): void => {
      buildPlayerSim(entity, props);
      entity.add(NetPlayer, props.netId);
    },
  });
