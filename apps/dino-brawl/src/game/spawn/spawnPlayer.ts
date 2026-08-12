import type { Vec2 } from "@atlasjs/math";
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
  createRunningAudioPrefab,
  createRunningParticlePrefab,
  createPlayerPrefab,
  createShadowPrefab,
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
  const grassSound: AudioClip = assetsLoader.getAsset("audio:grass_audio");

  const shadowPrefab: Prefab<ShadowPrefabProps> = createShadowPrefab();
  const runningParticlePrefab: Prefab<RunningParticlePrefabProps> =
    createRunningParticlePrefab({
      sprite: particleSprite,
      sound: grassSound,
      clips: () => sheetLoader.createClips("sheet:running_particle"),
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

  instantiator.instantiate(
    shadowPrefab,
    { sprite: shadowSprite },
    { parent: player.id },
  );

  return player.id;
}
