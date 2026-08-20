import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SceneContext } from "@atlasjs/core";
import type { GameEntity } from "@atlasjs/gameplay";
import type { Entity } from "@atlasjs/nexus";

import type { AssetsLoader } from "../loaders";
import type { SheetLoader } from "../sheets";

import {
  type EntityBuilder,
  type Instantiator,
  type Prefab,
  INSTANTIATOR,
  Sprite,
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

import {
  AttackChain,
  SpinAttack,
  SwingAttack,
  ThrustAttack,
  type WeaponAttack,
} from "../scripts";

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
  const woosh1Sound: AudioClip = assetsLoader.getAsset("audio:woosh_1");
  const woosh2Sound: AudioClip = assetsLoader.getAsset("audio:woosh_2");
  const woosh3Sound: AudioClip = assetsLoader.getAsset("audio:woosh_3");

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
    { anchor: new Vec2(0, -10) },
    { parent: player.id }
  );

  instantiator.instantiate(swordWithShadowPrefab, {
    swordSprite,
    shadowSprite,
    owner: player.id,
    anchor: anchor.id,
    angle: 0,
    r: 40,
    attack: (e: EntityBuilder): WeaponAttack =>
      e.attach(AttackChain, {
        attacks: [
          e.attach(ThrustAttack, { clip: woosh1Sound, pitch: 1 }),
          e.attach(SwingAttack, { clip: woosh2Sound, pitch: 1.1 }),
          e.attach(SpinAttack, { clip: woosh3Sound, pitch: 1.2 }),
        ],
      }),
  });

  instantiator.instantiate(
    shadowPrefab, 
    { sprite: shadowSprite, scale: new Vec2(0.7, 0.6), offset: new Vec2(-0.5, -3) },
    { parent: player.id }
  );

  return player.id;
}
