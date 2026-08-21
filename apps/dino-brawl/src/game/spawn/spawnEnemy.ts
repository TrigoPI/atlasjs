import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SceneContext } from "@atlasjs/core";
import type { GameEntity } from "@atlasjs/gameplay";
import type { Entity } from "@atlasjs/nexus";

import type { AssetsLoader } from "../loaders";
import type { SheetLoader } from "../sheets";

import {
  type Instantiator,
  type Prefab,
  INSTANTIATOR,
  Sprite,
} from "@atlasjs/gameplay";

import {
  type EnemyPrefabProps,
  type ImpactPrefabProps,
  type ShadowPrefabProps,
  createEnemyPrefab,
  createImpactPrefab,
  createShadowPrefab,
} from "../prefabs";

// prettier-ignore
export function spawnEnemy(
  ctx: SceneContext,
  spawnPosition: Vec2,
  assetsLoader: AssetsLoader,
  sheetLoader: SheetLoader,
): Entity {
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

  const dinoSprite: Sprite = assetsLoader.getAsset("sprite:evil_dino");
  const shadowSprite: Sprite = assetsLoader.getAsset("sprite:shadow");
  const hitSound: AudioClip = assetsLoader.getAsset("audio:hit");
  const impactSprite: Sprite = assetsLoader.getAsset("sprite:impact");
  const impactPrefab: Prefab<ImpactPrefabProps> = createImpactPrefab({
    sprite: impactSprite,
    scale: 1.5,
    clips: () => sheetLoader.createClips("sheet:impact"),
  });

  const shadowPrefab: Prefab<ShadowPrefabProps> = createShadowPrefab();
  const enemyPrefab: Prefab<EnemyPrefabProps> = createEnemyPrefab();

  const enemy: GameEntity = instantiator.instantiate(enemyPrefab, {
    position: spawnPosition,
    sprite: dinoSprite,
    hitClip: hitSound,
    impactPrefab,
    clips: sheetLoader.createClips("sheet:evil_dino"),
  });

  instantiator.instantiate(
    shadowPrefab,
    { sprite: shadowSprite, scale: new Vec2(0.7, 0.6), offset: new Vec2(-0.5, -3) },
    { parent: enemy.id }
  );

  return enemy.id;
}
