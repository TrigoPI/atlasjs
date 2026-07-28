import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ScriptManager,
  Grid,
  SCRIPT_MANAGER,
  TileMap,
  TileMapRenderer,
  TileSet,
  TileSetAsset,
  Transform2D,
} from "@atlasjs/gameplay";

import type { MapLoader } from "../tiled";
import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, MAP_SCALE } from "../config";
import { TileMapBuilderScript } from "../scripts";

export async function spawnWorld(
  ctx: SceneContext,
  mapLoader: MapLoader,
): Promise<void> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const groundTileSetAsset: TileSetAsset = TileSetAsset.fromPath(
    ResourcesPath.Tilesets.Ground.Grass,
    { tileHeight: 32, tileWidth: 32 },
  );

  const propsTileSetAsset: TileSetAsset = TileSetAsset.fromPath(
    ResourcesPath.Tilesets.Props.Default,
    { tileHeight: 32, tileWidth: 32 },
  );

  const groundTileSet: TileSet = await assets.load<TileSet>(groundTileSetAsset);
  const propsTileSet: TileSet = await assets.load<TileSet>(propsTileSetAsset);

  const gridEntity: Entity = nexus.createEntity();
  nexus.addComponent(gridEntity, Transform2D);
  nexus.addComponent(gridEntity, Grid, new Vec2(32, 32));

  const ground: Entity = nexus.createEntity();
  nexus.addComponent(ground, Transform2D);
  nexus.addComponent(ground, TileMapRenderer).sortingLayer = SortingLayer.Ground;
  nexus.addComponent(ground, TileMap, groundTileSet);

  const props: Entity = nexus.createEntity();
  nexus.addComponent(props, Transform2D);
  nexus.addComponent(props, TileMapRenderer).sortingLayer = SortingLayer.Ground;
  nexus.addComponent(props, TileMap, propsTileSet);

  nexus.setParent(ground, gridEntity);
  nexus.setParent(props, gridEntity);

  scriptManager.attach(ground, TileMapBuilderScript, {
    tilesetName: "ground_layer",
    grid: gridEntity,
    scale: MAP_SCALE,
    loader: mapLoader,
  });

  scriptManager.attach(props, TileMapBuilderScript, {
    tilesetName: "props_layer",
    grid: gridEntity,
    scale: MAP_SCALE,
    loader: mapLoader,
  });
}
