import { Instantiator, INSTANTIATOR, type Prefab } from "@atlasjs/gameplay";
import type { SceneContext } from "@atlasjs/core";
import type { Sprite } from "@atlasjs/nebula";

import type { AssetsLoader, AssetName } from "../loaders";
import { createArenaPrefab, type ArenaPrefabProps } from "../prefabs";

export function spawnArena(
  ctx: SceneContext,
  assetsLoader: AssetsLoader<AssetName>,
): void {
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);
  const arenaSprite: Sprite = assetsLoader.getAsset("sprite:arena");
  const arenaPrefab: Prefab<ArenaPrefabProps> = createArenaPrefab();

  instantiator.instantiate(arenaPrefab, {
    sprite: arenaSprite,
    showBounds: false,
  });
}
