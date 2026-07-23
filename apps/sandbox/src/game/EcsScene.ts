import BlueDino from "@assets/game/dinos/dino_blue.png";
import Sword from "@assets/game/swords/Iicon_32_10.png";
import GrassTileset from "@assets/game/environement/grass.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";
import { Vec2 } from "@atlasjs/math";

import { PlayerScript } from "./scripts/PlayerScript";
import { SwordScript } from "./scripts/SwordScript";
import { PlayerMovementScript } from "./scripts/PlayerMovementScript";
import { CameraScript } from "./scripts/CameraScript";

import {
  type CameraManager,
  type ScriptManager,
  type TileSet,
  Key,
  button,
  Camera,
  Grid,
  Sprite,
  vector2,
  CAMERA_MANAGER,
  defineActions,
  SCRIPT_MANAGER,
  SpriteAsset,
  SpriteRenderer,
  Animator,
  RigidBody,
  PlayerInput,
  Transform2D,
  TileMap,
  TileMapRenderer,
  TileSetAsset,
} from "@atlasjs/gameplay";

import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  // prettier-ignore
  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
    const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

    const dinoAsset: TextureAsset = new TextureAsset(BlueDino);
    const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset);
    const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(Sword);

    const blueDinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);
    const blueDinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);
    const swordSprite: Sprite = await assets.load<Sprite>(swordSpriteAsset);

    const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
    });

    const controls = defineActions({
      move: vector2().wasd(),
      boost: button().keys(Key.Space),
      hello: button().keys(Key.MouseLeft),
    });

    const clips: Record<string, SpriteAnimation> = {
      idle: new SpriteAnimation({
        frames: playerSheet.getManyInRange("blue_dino_", 0, 3),
        fps: 5,
        loop: true,
        autoPlay: true,
      }),
      run: new SpriteAnimation({
        frames: playerSheet.getManyInRange("blue_dino_", 4, 9),
        fps: 12,
        loop: true,
        autoPlay: true,
      }),
    };

    const player: Entity = nexus.createEntity();
    nexus.addComponent(player, Transform2D);
    nexus.addComponent(player, RigidBody);
    nexus.addComponent(player, Animator, clips, "idle");
    nexus.addComponent(player, SpriteRenderer, blueDinoSprite);
    nexus.addComponent(player, PlayerInput, controls);

    const sword: Entity = nexus.createEntity();
    nexus.addComponent(sword, Transform2D);
    nexus.addComponent(sword, SpriteRenderer, swordSprite);

    const cameraEntity: Entity = nexus.createEntity();
    nexus.addComponent(cameraEntity, Camera);
    nexus.addComponent(cameraEntity, Transform2D);

    scriptManager.attach(sword, SwordScript, {
      scale: 1.7,
      owner: player,
      sprite: swordSprite,
      maxPower: 500,
      orbitRadius: 45,
      throwDuration: 1,
      rotationSpeed: {
        max: 10 * Math.PI,
        min: Math.PI / 2,
      },
      orbitSpeed: {
        max: 6 * Math.PI,
        min: Math.PI,
      },
    });

    scriptManager.attach(player, PlayerScript);
    scriptManager.attach(player, PlayerMovementScript, {
      speed: 250,
    });

    scriptManager.attach(cameraEntity, CameraScript, {
      target: player,
    });

    cameraManager.setActive(cameraEntity);

    const grassTileset: TileSet = await assets.load<TileSet>(
      TileSetAsset.fromPath(GrassTileset, { tileWidth: 128, tileHeight: 128 }),
    );

    const grid: Entity = nexus.createEntity();
    nexus.addComponent(grid, Grid, new Vec2(128, 128));
    const gridTransform: Transform2D = nexus.addComponent(grid, Transform2D);
    gridTransform.scale.set(2.5, 2.5);

    const ground: Entity = nexus.createEntity();
    const groundMap: TileMap = nexus.addComponent(ground, TileMap, grassTileset);
    nexus.addComponent(ground, TileMapRenderer, 0);
    nexus.addComponent(ground, Transform2D);
    nexus.setParent(ground, grid);

    groundMap.fill(0, 0, 9, 9, grassTileset.indexOf(0, 1));
  }
}
