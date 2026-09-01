import type { SceneContext } from "@atlasjs/core";
import type { Vec2 } from "@atlasjs/math";
import type { Sprite } from "@atlasjs/nebula";

import type { AssetName, AssetsLoader } from "../loaders";
import { createPlayerPrefab, type PlayerPrefabProps } from "../prefabs";

import {
  Color,
  INSTANTIATOR,
  type Instantiator,
  type Prefab,
} from "@atlasjs/gameplay";

export function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
  assetsLoader: AssetsLoader<AssetName>,
): void {
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);
  const playerSprite: Sprite = assetsLoader.getAsset("sprite:player");

  const playerPrefab: Prefab<PlayerPrefabProps> = createPlayerPrefab();

  instantiator.instantiate(playerPrefab, {
    color: Color.White(),
    sprite: playerSprite,
    position: spawnPosition,
  });
}
