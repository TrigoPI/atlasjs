import {
  definePrefab,
  PlayerInput,
  type ActionMapDescriptor,
  type EntityBuilder,
} from "@atlasjs/gameplay";

import { buildPlayerSim, type PlayerSimProps } from "../../sim/prefabs";
import type { PlayerControlsType } from "../../sim/controls";

import { buildPlayerView, type PlayerViewProps } from "./buildPlayerView";

export type PlayerPrefabProps = PlayerSimProps &
  PlayerViewProps & {
    controls: ActionMapDescriptor<PlayerControlsType>;
  };

export const createPlayerPrefab = () =>
  definePrefab<PlayerPrefabProps>({
    name: "player",
    build: (entity: EntityBuilder, props: PlayerPrefabProps): void => {
      buildPlayerSim(entity, props);
      buildPlayerView(entity, props);

      entity.add(PlayerInput, props.controls);
    },
  });
