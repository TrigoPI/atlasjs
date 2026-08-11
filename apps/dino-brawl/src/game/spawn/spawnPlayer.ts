import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import { ResourcesPath } from "../ResourcesPath";
import { dinoControls } from "../controls";
import { SortingLayer, SortingOrder, CollisionLayers } from "../config";

import {
  PlayerAnimationScript,
  PlayerMovementScript,
  RunningAudioPlayerScript,
  RunningParticleScript,
  RunningParticleSpawnerScript,
} from "../scripts";

import {
  type EntityBuilder,
  type Prefab,
  type ScriptManager,
  type Sprite,
  Animator,
  AudioSource,
  CharacterController2D,
  Collider2D,
  Color,
  definePrefab,
  PlayerInput,
  RigidBody,
  SCRIPT_MANAGER,
  SpriteAsset,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";
import { AudioClip, AudioClipAsset } from "@atlasjs/audio";
import { randomRange, pickRandom } from "@atlasjs/utils";

// prettier-ignore
export async function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
): Promise<{ player: Entity; shadow: Entity }> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const shadowSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Props.Shadow);
  const runningParticleSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Particles.RunningCloud);
  const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Sprites.Dinos.Yellow);
  const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, { pivot: new Vec2(0.5, 1) });
  const grassSoundAsset: AudioClipAsset = new AudioClipAsset(ResourcesPath.Audio.Grass);

  const dinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);
  const dinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);
  const shadowSprite: Sprite = await assets.load<Sprite>(shadowSpriteAsset);
  const runningParticleSprite: Sprite = await assets.load<Sprite>(runningParticleSpriteAsset);

  const grassSound: AudioClip = await assets.load<AudioClip>(grassSoundAsset);

  const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
    name: "player_dino",
    texture: dinoTexture,
    rows: 1,
    columns: 24,
    pivot: new Vec2(0.5, 1),
  });

  const runningParticleSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
    name: "running_particle",
    texture: runningParticleSprite.texture,
    rows: 1,
    columns: 8,
    pivot: new Vec2(0.5, 1),
  });

  const clips: Record<string, SpriteAnimation> = {
    idle: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 0, 3),
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    run: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 4, 9),
      fps: 12,
      loop: true,
      autoPlay: true,
    }),
    pre_sprint: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 17, 17),
      fps: 1,
      loop: false,
      autoPlay: true,
    }),
    sprint: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 18, 23),
      fps: 12,
      loop: true,
      autoPlay: true,
    }),
  };


  const player: Entity = nexus.createEntity();
  const playerTransform: Transform2D = nexus.addComponent(player, Transform2D);
  const playerBody: RigidBody = nexus.addComponent(player, RigidBody);
  playerBody.type = "kinematic";

  nexus.addComponent(player, Animator, clips, "idle");
  const playerRender: SpriteRenderer = nexus.addComponent(
    player,
    SpriteRenderer,
    dinoSprite,
  );

  nexus.addComponent(player, PlayerInput, dinoControls);

  playerRender.sortingLayer = SortingLayer.Entities;
  playerRender.sortingOrder = SortingOrder.Player;
  playerTransform.scale.set(3, 3);
  playerTransform.position.copyFrom(spawnPosition);

  const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
    type: "box",
    width: 32,
    height: 16,
  });

  playerCollider.offset.set(0, -15);
  playerCollider.layer = CollisionLayers.Player;
  playerCollider.collidesWith = CollisionLayers.World;

  nexus.addComponent(player, CharacterController2D);

  const shadow: Entity = nexus.createEntity();
  const shadowTransform: Transform2D = nexus.addComponent(shadow, Transform2D);
  const shadowRender: SpriteRenderer = nexus.addComponent(
    shadow,
    SpriteRenderer,
    shadowSprite,
  );

  shadowRender.sortingLayer = SortingLayer.Entities;
  shadowRender.sortingOrder = SortingOrder.Shadow;
  shadowRender.color = new Color(1, 1, 1, 0.4);
  shadowTransform.scale.set(0.7, 0.6);
  shadowTransform.position.set(-0.5, -3);

  const runningParticlePrefab: Prefab<{ position: Vec2 }> = definePrefab({
    name: "runningParticle",
    build: (entity: EntityBuilder, { position }): void => {
      const runningParticleClips: Record<string, SpriteAnimation> = {
        default: new SpriteAnimation({
          frames: runningParticleSheet.getManyInRange("running_particle_", 0, 7),
          fps: 15,
          loop: false,
          autoPlay: true,
        })
      };

      entity.add(Animator, runningParticleClips, "default");
      entity.add(AudioSource, grassSound);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, runningParticleSprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = 100;

      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.set(2, 2);
      transform.position.copyFrom(position);

      entity.attach(RunningParticleScript);
    }
  })

  const runningAudioPlayer: Prefab = definePrefab({
    name: "runningAudioPlayer",
    build: (entity: EntityBuilder): void => {
      const audio: AudioSource = entity.add(AudioSource, pickRandom([grassSound]), {
        playOnAwake: true,
      });

      audio.volume = randomRange(0.05, 0.1);
      audio.pitch = randomRange(0.9, 1.1);
    },
  });

  nexus.setParent(shadow, player);

  scriptManager.attach(player, RunningParticleSpawnerScript, {
    runningParticlePrefab: runningParticlePrefab,
  });

  scriptManager.attach(player, RunningAudioPlayerScript, {
    audioPrefab: runningAudioPlayer,
  })

  scriptManager.attach(player, PlayerAnimationScript);
  scriptManager.attach(player, PlayerMovementScript, {
    walkingSpeed: 200,
    runningSpeed: 205,
  });

  return { player, shadow };
}
