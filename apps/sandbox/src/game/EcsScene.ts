import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import type { PinObject } from "./map-loader/map-object";
import { ResourcesPath } from "./ResourcesPath";
import { MapLoader } from "./map-loader";

import {
  SwordScript,
  PlayerScript,
  PlayerMovementScript,
  CameraScript,
  MapBuilderScript,
  CameraZoomScript,
} from "./scripts";

import {
  type CameraManager,
  type ScriptManager,
  type SortingLayers,
  type ColliderShapeDesc,
  Key,
  button,
  Camera,
  Grid,
  Sprite,
  vector2,
  CAMERA_MANAGER,
  defineActions,
  defineCollisionLayers,
  SCRIPT_MANAGER,
  SORTING_LAYERS,
  SpriteAsset,
  SpriteRenderer,
  Animator,
  Collider2D,
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

const MAP_SCALE: number = 2;

const Layers = defineCollisionLayers("Player", "Occluder");

export class EcsScene extends Scene {
  private fpsCallback: (fps: number) => void;

  public constructor(cb: (fps: number) => void) {
    super("game-scene");
    this.fpsCallback = cb;
  }

  // prettier-ignore
  public override async onCreate(ctx: SceneContext): Promise<void> {
    const mapLoader: MapLoader = new MapLoader(ResourcesPath.Map);

    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);
    sortingLayers.define([
      { name: "Ground", mode: "manual" },
      { name: "Entities", mode: "ySorted" },
      { name: "Overhead", mode: "manual" },
    ]);

    await this.loadMap(mapLoader, ctx);
    await this.initializePlayer(mapLoader, ctx);
  }

  private async loadMap(
    mapLoader: MapLoader,
    ctx: SceneContext,
  ): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    // prettier-ignore
    const groundTileSetAsset: TileSetAsset = TileSetAsset.fromPath(ResourcesPath.Tilesets.Ground.Grass, {
      tileHeight: 32,
      tileWidth: 32,
    });

    // prettier-ignore
    const propsTileSetAsset: TileSetAsset = TileSetAsset.fromPath(ResourcesPath.Tilesets.Props.Default, {
      tileHeight: 32,
      tileWidth: 32,
    });

    const groundTileSet: TileSet =
      await assets.load<TileSet>(groundTileSetAsset);

    const propsTileSet: TileSet = await assets.load<TileSet>(propsTileSetAsset);

    const gridEntity: Entity = nexus.createEntity();
    nexus.addComponent(gridEntity, Transform2D);
    nexus.addComponent(gridEntity, Grid, new Vec2(32, 32));

    const ground: Entity = nexus.createEntity();
    nexus.addComponent(ground, Transform2D);
    nexus.addComponent(ground, TileMapRenderer).sortingLayer = "Ground";
    nexus.addComponent(ground, TileMap, groundTileSet);

    const props: Entity = nexus.createEntity();
    nexus.addComponent(props, Transform2D);
    nexus.addComponent(props, TileMapRenderer).sortingLayer = "Ground";
    nexus.addComponent(props, TileMap, propsTileSet);

    nexus.setParent(ground, gridEntity);
    nexus.setParent(props, gridEntity);

    scriptManager.attach(ground, MapBuilderScript, {
      tilesetName: "ground_layer",
      grid: gridEntity,
      scale: MAP_SCALE,
      loader: mapLoader,
    });

    scriptManager.attach(props, MapBuilderScript, {
      tilesetName: "props_layer",
      grid: gridEntity,
      scale: MAP_SCALE,
      loader: mapLoader,
    });
  }

  // prettier-ignore
  private async initializePlayer(mapLoader: MapLoader, ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
    const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

    const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Swords.Default);
    const shadowSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Props.Shadow);
    const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Sprites.Dinos.Yellow);
    const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, {
      pivot: new Vec2(0.5, 1),
    });

    const blueDinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);
    const blueDinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);
    const swordSprite: Sprite = await assets.load<Sprite>(swordSpriteAsset);
    const shadowSprite: Sprite = await assets.load<Sprite>(shadowSpriteAsset);

    const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
      pivot: new Vec2(0.5, 1),
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
      sprint: new SpriteAnimation({
        frames: playerSheet.getManyInRange("blue_dino_", 17, 23),
        fps: 12,
        loop: true,
        autoPlay: true,
      })
    };

    const player: Entity = nexus.createEntity();
    nexus.addComponent(player, Transform2D);
    nexus.addComponent(player, RigidBody);
    nexus.addComponent(player, Animator, clips, "idle");
    nexus.addComponent(player, SpriteRenderer, blueDinoSprite).sortingLayer = "Entities";
    nexus.addComponent(player, PlayerInput, controls);

    const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
      type: "circle",
      radius: 10,
    } as ColliderShapeDesc);
    playerCollider.layer = Layers.Player;
    playerCollider.collidesWith = Layers.Occluder;

    const sword: Entity = nexus.createEntity();
    nexus.addComponent(sword, Transform2D);
    nexus.addComponent(sword, SpriteRenderer, swordSprite).sortingLayer = "Entities";

    const cameraEntity: Entity = nexus.createEntity();
    nexus.addComponent(cameraEntity, Camera);
    nexus.addComponent(cameraEntity, Transform2D);

    const shadow: Entity = nexus.createEntity();
    nexus.addComponent(shadow, Transform2D);
    const shadowRender: SpriteRenderer = nexus.addComponent(shadow, SpriteRenderer, shadowSprite);
    shadowRender.sortingLayer = "Entities";
    shadowRender.sortingOrder = -1;

    const spawn: PinObject | undefined = mapLoader.getObject<PinObject>("spawn_point");
    const spawnPosition: Vec2 = spawn ?
      Vec2.create(spawn.x, spawn.y).mult(MAP_SCALE) :
      Vec2.zero();

    const treeAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Tilesets.Player.Tree1, {
      pivot: new Vec2(0.5, 0.95),
    });
    
    const treeSprite: Sprite = await assets.load<Sprite>(treeAsset);

    const treePositions: Vec2[] = [
      new Vec2(spawnPosition.x - 110, spawnPosition.y - 48),
      new Vec2(spawnPosition.x + 110, spawnPosition.y + 48),
    ];

    for (const treePosition of treePositions) {
      const tree: Entity = nexus.createEntity();
      const treeTransform: Transform2D = nexus.addComponent(tree, Transform2D);
      treeTransform.position = treePosition;
      nexus.addComponent(tree, SpriteRenderer, treeSprite).sortingLayer = "Entities";

      const treeCollider: Collider2D = nexus.addComponent(tree, Collider2D, {
        type: "box",
        width: 24,
        height: 24,
      } as ColliderShapeDesc);
      treeCollider.layer = Layers.Occluder;
      treeCollider.collidesWith = Layers.Player;
    }

    nexus.setParent(shadow, player);

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

    scriptManager.attach(player, PlayerScript, {
      shadow: shadow,
      spawn: spawnPosition,
    });

    scriptManager.attach(player, PlayerMovementScript, {
      speed: 250,
    });

    scriptManager.attach(cameraEntity, CameraScript, {
      target: player,
    });

    scriptManager.attach(cameraEntity, CameraZoomScript, {});

    cameraManager.setActive(cameraEntity);
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }
}
