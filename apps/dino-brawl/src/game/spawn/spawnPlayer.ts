import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ColliderShapeDesc,
  type ScriptManager,
  type Sprite,
  Animator,
  Collider2D,
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

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, CollisionLayers } from "../config";
import { dinoControls } from "../controls";
import { PlayerScript, PlayerMovementScript } from "../scripts";

export async function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
): Promise<{ player: Entity; shadow: Entity }> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const shadowSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Props.Shadow);
  const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Sprites.Dinos.Yellow);
  const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, {
    pivot: new Vec2(0.5, 1),
  });

  const dinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);
  const dinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);
  const shadowSprite: Sprite = await assets.load<Sprite>(shadowSpriteAsset);

  const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
    name: "player_dino",
    texture: dinoTexture,
    rows: 1,
    columns: 24,
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
    sprint: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 17, 23),
      fps: 12,
      loop: true,
      autoPlay: true,
    }),
  };

  const player: Entity = nexus.createEntity();
  nexus.addComponent(player, Transform2D);
  nexus.addComponent(player, RigidBody);
  nexus.addComponent(player, Animator, clips, "idle");
  nexus.addComponent(player, SpriteRenderer, dinoSprite).sortingLayer = SortingLayer.Entities;
  nexus.addComponent(player, PlayerInput, dinoControls);

  const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
    type: "circle",
    radius: 10,
  } as ColliderShapeDesc);
  playerCollider.layer = CollisionLayers.Player;
  playerCollider.collidesWith = CollisionLayers.Occluder;

  const shadow: Entity = nexus.createEntity();
  nexus.addComponent(shadow, Transform2D);
  nexus.addComponent(shadow, SpriteRenderer, shadowSprite).sortingLayer = SortingLayer.Entities;

  nexus.setParent(shadow, player);

  scriptManager.attach(player, PlayerScript, {
    shadow: shadow,
    spawn: spawnPosition,
  });

  scriptManager.attach(player, PlayerMovementScript, {
    speed: 250,
  });

  return { player, shadow };
}
