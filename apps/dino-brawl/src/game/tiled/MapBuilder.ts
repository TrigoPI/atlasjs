import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";
import { createLogger, type Logger } from "@atlasjs/utils";

import type { TiledDocument } from "./TiledDocument";
import type { TiledAssetResolver } from "./TiledAssetResolver";
import type { SortingLayerInput } from "./sorting";
import { ingestOccluders, isOccluderRegion } from "./ingestOccluders";

import {
  type Sprite as SpriteType,
  type SpriteRender,
  type Tile,
  type TileSet as TileSetType,
  Grid,
  Sprite,
  SpriteRenderer,
  TileMap,
  TileMapRenderer,
  TileSetAsset,
  Transform2D,
} from "@atlasjs/gameplay";

import type {
  PointObject,
  RectObject,
  ResolvedCell,
  ResolvedTileLayer,
  ResolvedTileset,
  TileObject,
} from "./resolved.types";

import {
  type MapCollider,
  type WorldPoint,
  type TilePlacement,
  colliderFromRect,
  groupCellsByTileset,
  tileObjectPlacement,
  worldPointFromObject,
} from "./mapMath";

export interface MapBuilderOptions {
  readonly resolver: TiledAssetResolver;
  readonly scale: number;
  readonly resolveSortingLayer: (layer: SortingLayerInput) => string;
  readonly objectSortingLayer?: string;
}

export interface BuiltMap {
  readonly grid: Entity;
  readonly tileLayers: readonly Entity[];
  readonly objectEntities: readonly Entity[];
  readonly colliders: readonly MapCollider[];
  readonly points: Readonly<Record<string, WorldPoint>>;
}

export class MapBuilder {
  public static async build(
    ctx: SceneContext,
    doc: TiledDocument,
    options: MapBuilderOptions,
  ): Promise<BuiltMap> {
    const logger: Logger = createLogger(MapBuilder.name);
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const objectLayer: string = options.objectSortingLayer ?? "Entities";

    // prettier-ignore
    const tilesets: Map<ResolvedTileset, TileSetType> = new Map<ResolvedTileset, TileSetType>();

    for (const ts of doc.tilesets) {
      const url: string | undefined = options.resolver(ts);

      if (url === undefined) {
        continue;
      }

      const asset: TileSetAsset = TileSetAsset.fromPath(url, {
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        columns: ts.columns,
        rows: ts.rows,
        spacing: ts.spacing,
        margin: ts.margin,
      });

      tilesets.set(ts, await assets.load<TileSetType>(asset));
    }

    const grid: Entity = nexus.createEntity();

    nexus
      .addComponent(grid, Transform2D)
      .scale.set(options.scale, options.scale);

    nexus.addComponent(grid, Grid, new Vec2(doc.tileWidth, doc.tileHeight));

    const tileLayers: Entity[] = [];
    const occluderLayerEntities: Entity[] = [];
    for (const layer of doc.tileLayers) {
      const layerEntities: Entity[] = [];
      MapBuilder.buildTileLayer(
        nexus,
        grid,
        layer,
        tilesets,
        options,
        layerEntities,
        logger,
      );
      tileLayers.push(...layerEntities);
      if (layer.name.startsWith("Occluders")) {
        occluderLayerEntities.push(...layerEntities);
      }
    }

    const objectEntities: Entity[] = [];
    const colliders: MapCollider[] = [];
    const points: Record<string, WorldPoint> = {};

    for (const obj of doc.objects) {
      if (obj.kind === "point") {
        const point: PointObject = obj;
        points[point.name] = worldPointFromObject(point, options.scale);
      } else if (obj.kind === "rect") {
        const rect: RectObject = obj;
        if (!isOccluderRegion(rect)) {
          colliders.push(colliderFromRect(rect, options.scale));
        }
      } else {
        const entity: Entity | undefined = MapBuilder.buildTileObject(
          nexus,
          obj,
          tilesets,
          objectLayer,
          options.scale,
          logger,
        );
        if (entity !== undefined) {
          objectEntities.push(entity);
        }
      }
    }

    ingestOccluders(nexus, grid, doc, occluderLayerEntities, options.scale, objectLayer, logger);
    for (const layerEntity of occluderLayerEntities) {
      nexus.removeComponent(layerEntity, TileMapRenderer);
    }

    return { grid, tileLayers, objectEntities, colliders, points };
  }

  private static buildTileLayer(
    nexus: NexusWorld,
    grid: Entity,
    layer: ResolvedTileLayer,
    tilesets: Map<ResolvedTileset, TileSetType>,
    options: MapBuilderOptions,
    out: Entity[],
    logger: Logger,
  ): void {
    const sortingLayer: string = options.resolveSortingLayer({
      name: layer.name,
      groupPath: layer.groupPath,
    });

    const buckets: Map<ResolvedTileset, ResolvedCell[]> =
      groupCellsByTileset(layer);

    for (const [resolvedTileset, cells] of buckets) {
      const tileset: TileSetType | undefined = tilesets.get(resolvedTileset);

      if (tileset === undefined) {
        // prettier-ignore
        logger.warn(`Layer '${layer.name}': tileset '${resolvedTileset.name}' unresolved; ${cells.length} cells skipped.`);
        continue;
      }

      const entity: Entity = nexus.createEntity();
      nexus.addComponent(entity, Transform2D);
      const tileMap: TileMap = nexus.addComponent(entity, TileMap, tileset);
      const renderer: TileMapRenderer = nexus.addComponent(
        entity,
        TileMapRenderer,
      );

      renderer.sortingOrder = layer.order;
      renderer.sortingLayer = sortingLayer;

      nexus.setParent(entity, grid);

      for (const cell of cells) {
        tileMap.setTile(cell.cx, cell.cy, cell.localIndex);
      }

      out.push(entity);
    }
  }

  private static buildTileObject(
    nexus: NexusWorld,
    obj: TileObject,
    tilesets: Map<ResolvedTileset, TileSetType>,
    sortingLayer: string,
    scale: number,
    logger: Logger,
  ): Entity | undefined {
    const tileset: TileSetType | undefined = tilesets.get(obj.tileset);
    if (tileset === undefined) {
      logger.warn(
        `Tile-object '${obj.name}': tileset '${obj.tileset.name}' unresolved; skipped.`,
      );
      return undefined;
    }

    const tile: Tile | undefined = tileset.tryGetTile(obj.localIndex);
    if (tile === undefined) {
      logger.warn(
        `Tile-object '${obj.name}': tile index ${obj.localIndex} out of range in tileset '${obj.tileset.name}'; skipped.`,
      );
      return undefined;
    }

    const base: SpriteType = tile.sprite;
    const sprite: SpriteType = new Sprite(tileset.texture, {
      rect: base.rect,
      pivot: new Vec2(0.5, 1),
    });

    const placement: TilePlacement = tileObjectPlacement(obj, scale);
    const entity: Entity = nexus.createEntity();
    const transform: Transform2D = nexus.addComponent(entity, Transform2D);
    transform.position.copyFrom(placement.position);
    transform.scale.copyFrom(placement.scale);

    const render: SpriteRender = nexus.addComponent(
      entity,
      SpriteRenderer,
      sprite,
    );
    render.sortingLayer = sortingLayer;
    render.flipX = obj.flipX;
    render.flipY = obj.flipY;

    return entity;
  }
}
