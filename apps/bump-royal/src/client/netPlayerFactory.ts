import type { AudioClip } from "@atlasjs/audio";
import type { Instantiator, Prefab, Sprite } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import type { AssetName, AssetsLoader } from "../game/view/loaders";
import { createPlayerViewPrefab } from "../game/view/prefabs/PlayerViewPrefab";
import type { PlayerViewPrefabProps } from "../game/view/prefabs/PlayerViewPrefab";
import type { PlayerInfo } from "../net/protocol";

import type { NetPlayerFactory } from "./NetworkClient";
import { playerColor } from "./palette";

export function createNetPlayerFactory(
  instantiator: Instantiator,
  assetsLoader: AssetsLoader<AssetName>,
): NetPlayerFactory {
  const prefab: Prefab<PlayerViewPrefabProps> = createPlayerViewPrefab();

  const playerSprite: Sprite = assetsLoader.getAsset("sprite:players");
  const playerEyesSprite: Sprite = assetsLoader.getAsset("sprite:player_eyes");
  const shadowSprite: Sprite = assetsLoader.getAsset("sprite:shadow");
  const dustSprite: Sprite = assetsLoader.getAsset("sprite:dust");

  const bumpAudio: AudioClip = assetsLoader.getAsset("audio:bump");
  const fallAudio: AudioClip = assetsLoader.getAsset("audio:fall");

  return {
    create: (info: PlayerInfo): Entity =>
      instantiator.instantiate(prefab, {
        netId: info.id,
        position: Vec2.create(info.spawn[0], info.spawn[1]),
        color: playerColor(info.color),
        playerSprite,
        playerEyesSprite,
        shadowSprite,
        dustSprite,
        bumpAudio,
        fallAudio,
      }).id,

    /* Through the instantiator so the removal goes via world.commands and lands at the next
       flush, together with the children buildPlayerView created. */
    destroy: (entity: Entity): void => instantiator.destroy(entity),
  };
}
