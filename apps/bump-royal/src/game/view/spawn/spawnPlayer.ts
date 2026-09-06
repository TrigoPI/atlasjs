import type { SceneContext } from "@atlasjs/core";
import type { AudioClip } from "@atlasjs/audio";
import type { Vec2 } from "@atlasjs/math";
import type { Sprite } from "@atlasjs/nebula";

import type { AssetName, AssetsLoader } from "../loaders";
import type { PlayerControlsType } from "../../sim/controls";
import { createPlayerPrefab, type PlayerPrefabProps } from "../prefabs";

import {
  Color,
  INSTANTIATOR,
  type ActionMapDescriptor,
  type Instantiator,
  type Prefab,
} from "@atlasjs/gameplay";

type PlayerSpawnProps = {
  position: Vec2;
  controls: ActionMapDescriptor<PlayerControlsType>;
  color: Color;
};

export function spawnPlayer(
  ctx: SceneContext,
  assetsLoader: AssetsLoader<AssetName>,
  props: PlayerSpawnProps,
): void {
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

  const playerSprite: Sprite = assetsLoader.getAsset("sprite:players");
  const playerEyesSprite: Sprite = assetsLoader.getAsset("sprite:player_eyes");
  const shadowSprite: Sprite = assetsLoader.getAsset("sprite:shadow");
  const dustSprite: Sprite = assetsLoader.getAsset("sprite:dust");

  const bumpAudio: AudioClip = assetsLoader.getAsset("audio:bump");
  const fallAudio: AudioClip = assetsLoader.getAsset("audio:fall");

  const playerPrefab: Prefab<PlayerPrefabProps> = createPlayerPrefab();

  instantiator.instantiate(playerPrefab, {
    bumpAudio: bumpAudio,
    fallAudio: fallAudio,
    playerSprite: playerSprite,
    playerEyesSprite: playerEyesSprite,
    shadowSprite: shadowSprite,
    dustSprite: dustSprite,
    color: props.color,
    position: props.position,
    controls: props.controls,
  });
}
