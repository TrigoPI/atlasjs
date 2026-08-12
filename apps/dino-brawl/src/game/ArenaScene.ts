import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";
import { type SortingLayers, SORTING_LAYERS } from "@atlasjs/gameplay";
import { ASSET_MANAGER, type AssetManager } from "@atlasjs/assets";
import type { Entity } from "@atlasjs/nexus";

import type { BuiltMap, WorldPoint } from "./tiled";

import { SortingLayer } from "./config";
import { SheetList, SheetLoader } from "./sheets";
import { spawnCamera, spawnPlayer, spawnWorld } from "./spawn";
import { AssetsLoader, AudioList, SpriteList, TextureList } from "./loaders";

export class ArenaScene extends Scene {
  private fpsCallback: (fps: number) => void;

  public constructor(cb: (fps: number) => void) {
    super("game-scene");
    this.fpsCallback = cb;
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);
    this.initLayer(sortingLayers);

    const asset: AssetManager = ctx.services.get(ASSET_MANAGER);
    const assetsLoader: AssetsLoader = new AssetsLoader(asset);
    await this.loadAssets(assetsLoader);

    const sheetLoader: SheetLoader = new SheetLoader(assetsLoader);
    this.loadSheets(sheetLoader);

    const builtMap: BuiltMap = await spawnWorld(ctx);
    const spawn: WorldPoint | undefined = builtMap.points["spawn_point"];
    const spawnPosition: Vec2 = spawn
      ? Vec2.create(spawn.x, spawn.y)
      : Vec2.zero();

    const player: Entity = spawnPlayer(
      ctx,
      spawnPosition,
      assetsLoader,
      sheetLoader,
    );

    spawnCamera(ctx, player);
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }

  private initAssets(assetLoader: AssetsLoader): void {
    for (const asset of TextureList) {
      assetLoader.addTexture(asset.name, asset.path);
    }

    for (const asset of SpriteList) {
      assetLoader.addSprite(asset.name, asset.path);
    }

    for (const asset of AudioList) {
      assetLoader.addAudio(asset.name, asset.path);
    }
  }

  private initLayer(sortingLayers: SortingLayers): void {
    sortingLayers.define([
      { name: SortingLayer.Ground, mode: "manual" },
      { name: SortingLayer.Entities, mode: "ySorted" },
      { name: SortingLayer.Overhead, mode: "manual" },
    ]);
  }

  private async loadAssets(assetsLoader: AssetsLoader): Promise<void> {
    this.initAssets(assetsLoader);
    await assetsLoader.load();
  }

  private loadSheets(sheetLoader: SheetLoader): void {
    for (const descriptor of SheetList) {
      sheetLoader.addSheet(descriptor);
    }

    sheetLoader.build();
  }
}
