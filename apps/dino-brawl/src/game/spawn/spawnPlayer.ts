import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import { ResourcesPath } from "../ResourcesPath";
import { dinoControls } from "../controls";

import { SortingLayer, SortingOrder, CollisionLayers } from "../config";
import { PlayerAnimationScript, PlayerMovementScript } from "../scripts";

import {
  type ScriptManager,
  type Sprite,
  Animator,
  CharacterController2D,
  Collider2D,
  Color,
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

// prettier-ignore
export async function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
): Promise<{ player: Entity; shadow: Entity }> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const shadowSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Props.Shadow);
  const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Sprites.Dinos.Yellow);
  const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, { pivot: new Vec2(0.5, 1) });

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
    type: "circle",
    radius: 10,
  });

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

  nexus.setParent(shadow, player);

  scriptManager.attach(player, PlayerAnimationScript, {});

  scriptManager.attach(player, PlayerMovementScript, {
    speed: 250,
  });

  return { player, shadow };
}
