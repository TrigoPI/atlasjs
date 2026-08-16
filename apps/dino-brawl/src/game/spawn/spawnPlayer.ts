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
  type Sprite,
  INSTANTIATOR,
} from "@atlasjs/gameplay";

import {
  type PlayerPrefabProps,
  type RunningParticlePrefabProps,
  type ShadowPrefabProps,
  type SwordWithShadowPrefabProps,
  type SwordAnchorPrefabProps,
  createRunningAudioPrefab,
  createRunningParticlePrefab,
  createPlayerPrefab,
  createShadowPrefab,
  createSwordWithShadowPrefab,
  createSwordAnchorPrefab,
} from "../prefabs";

// prettier-ignore
export function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
  assetsLoader: AssetsLoader,
  sheetLoader: SheetLoader,
): Entity {
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

  const dinoSprite: Sprite = assetsLoader.getAsset("sprite:yellow_dino");
  const shadowSprite: Sprite = assetsLoader.getAsset("sprite:shadow");
  const particleSprite: Sprite = assetsLoader.getAsset("sprite:running_particle");
  const swordSprite: Sprite = assetsLoader.getAsset("sprite:default_sword");
  const grassSound: AudioClip = assetsLoader.getAsset("audio:grass_audio");
  

  const shadowPrefab: Prefab<ShadowPrefabProps> = createShadowPrefab();
  const swordWithShadowPrefab: Prefab<SwordWithShadowPrefabProps> = createSwordWithShadowPrefab();
  const swordAnchorPrefab: Prefab<SwordAnchorPrefabProps> = createSwordAnchorPrefab();

  const runningParticlePrefab: Prefab<RunningParticlePrefabProps> =
    createRunningParticlePrefab({
      clips: () => sheetLoader.createClips("sheet:running_particle"),
      sprite: particleSprite,
      sound: grassSound,
    });

  const runningAudioPrefab: Prefab = createRunningAudioPrefab({
    sound: grassSound,
  });

  const playerPrefab: Prefab<PlayerPrefabProps> = createPlayerPrefab({
    runningAudioPrefab,
    runningParticlePrefab
  });

  const player: GameEntity = instantiator.instantiate(playerPrefab, {
    position: spawnPosition,
    sprite: dinoSprite,
    clips: sheetLoader.createClips("sheet:dino"),
  });

  const anchor: GameEntity = instantiator.instantiate(
    swordAnchorPrefab,
    { anchor: new Vec2(-15, -15) },
    { parent: player.id }
  );

  const swordCount: number = 6;
  for (let i: number = 0; i < swordCount; i++) {
    const angle: number = (i / swordCount) * Math.PI * 2;
    instantiator.instantiate(swordWithShadowPrefab, {
      owner: player.id,
      anchor: anchor.id,
      r: 40,
      angle,
      angularSpeed: 1.5,
      swordSprite,
      shadowSprite,
    });
  }

  instantiator.instantiate(
    shadowPrefab, 
    { sprite: shadowSprite, scale: new Vec2(0.7, 0.6), offset: new Vec2(-0.5, -3) },
    { parent: player.id }
  );

  return player.id;
}
