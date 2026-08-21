import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SceneContext } from "@atlasjs/core";
import type { GameEntity } from "@atlasjs/gameplay";
import type { Entity } from "@atlasjs/nexus";

import type { AssetsLoader } from "../loaders";
import type { SheetLoader } from "../sheets";

import { rappierSwordCombo } from "../content";

import {
  type Instantiator,
  type Prefab,
  INSTANTIATOR,
  Sprite,
} from "@atlasjs/gameplay";

import {
  type PlayerPrefabProps,
  type RunningParticlePrefabProps,
  type ShadowPrefabProps,
  type SwordPrefabProps,
  type SwordAnchorPrefabProps,
  createRunningAudioPrefab,
  createRunningParticlePrefab,
  createPlayerPrefab,
  createShadowPrefab,
  createSwordPrefab,
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
  const grassSound: AudioClip = assetsLoader.getAsset("audio:grass_audio");
  const woosh1Sound: AudioClip = assetsLoader.getAsset("audio:woosh_1");
  const woosh2Sound: AudioClip = assetsLoader.getAsset("audio:woosh_2");
  const woosh3Sound: AudioClip = assetsLoader.getAsset("audio:woosh_3");

  const swordSprite: Sprite = assetsLoader.getAsset("sprite:rappier_sword");

  const shadowPrefab: Prefab<ShadowPrefabProps> = createShadowPrefab();
  const swordPrefab: Prefab<SwordPrefabProps> = createSwordPrefab();
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
    { anchor: new Vec2(0, -10) },
    { parent: player.id }
  );

  instantiator.instantiate(swordPrefab, {
    swordSprite,
    owner: player.id,
    anchor: anchor.id,
    angle: 0,
    r: 40,
    attack: rappierSwordCombo({
      thrust: woosh1Sound,
      swing: woosh2Sound,
      lunge: woosh3Sound,
    }),
  });

  instantiator.instantiate(
    shadowPrefab, 
    { sprite: shadowSprite, scale: new Vec2(0.7, 0.6), offset: new Vec2(-0.5, -3) },
    { parent: player.id }
  );

  return player.id;
}
