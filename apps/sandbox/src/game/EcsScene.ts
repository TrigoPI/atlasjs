import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import { ResourcesPath } from "./ResourcesPath";
import { MapLoader } from "./map-loader";

import {
  SwordScript,
  PlayerScript,
  PlayerMovementScript,
  CameraScript,
  MapBuilderScript,
} from "./scripts";

import {
  type CameraManager,
  type ScriptManager,
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
  TileSet,
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
    await this.loadMap(ctx);
    await this.initializePlayer(ctx);
  }

  private async loadMap(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const mapLoader: MapLoader = new MapLoader(ResourcesPath.Map);

    // prettier-ignore
    const groundTileSetAsset: TileSetAsset = TileSetAsset.fromPath(ResourcesPath.Tilesets.Ground.Grass, {
      tileHeight: 32,
      tileWidth: 32,
    });

    const groundTileSet: TileSet =
      await assets.load<TileSet>(groundTileSetAsset);

    const gridEntity: Entity = nexus.createEntity();
    nexus.addComponent(gridEntity, Transform2D);
    nexus.addComponent(gridEntity, Grid, new Vec2(32, 32));

    const ground: Entity = nexus.createEntity();
    nexus.addComponent(ground, Transform2D);
    nexus.addComponent(ground, TileMapRenderer);
    nexus.addComponent(ground, TileMap, groundTileSet);

    nexus.setParent(ground, gridEntity);

    scriptManager.attach(ground, MapBuilderScript, {
      grid: gridEntity,
      loader: mapLoader,
      scale: 2,
    });
  }

  // prettier-ignore
  private async initializePlayer(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
    const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

    const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Dinos.Blue);
    const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset);
    const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Swords.Default);

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
  }
}
