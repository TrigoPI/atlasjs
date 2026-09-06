import {
  definePrefab,
  Transform2D,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";
import type { Vec2 } from "@atlasjs/math";

import type { NetId } from "../../../net/protocol";
import { PLAYER_SCALE } from "../../sim/prefabs/buildPlayerSim";
import { PlayerStatus } from "../../sim/PlayerStatus";

import { NetView } from "../NetView";
import { buildPlayerView, type PlayerViewProps } from "./buildPlayerView";

export type PlayerViewPrefabProps = PlayerViewProps & {
  netId: NetId;
  position: Vec2;
};

/* No RigidBody, no Collider2D, no MoveIntent and no simulation script: the server owns all of
   those, and this entity exists only to render replicated state. Transform2D is added here
   because buildPlayerView deliberately does not add one to the root. */
export const createPlayerViewPrefab = (): Prefab<PlayerViewPrefabProps> =>
  definePrefab<PlayerViewPrefabProps>({
    name: "player-view",
    build: (entity: EntityBuilder, props: PlayerViewPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position);
      transform.scale.set(PLAYER_SCALE, PLAYER_SCALE);

      entity.add(NetView, props.netId);
      entity.add(PlayerStatus);

      buildPlayerView(entity, props);
    },
  });
