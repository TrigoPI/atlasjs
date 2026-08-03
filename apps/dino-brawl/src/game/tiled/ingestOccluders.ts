import { Vec2 } from "@atlasjs/math";
import type { Logger } from "@atlasjs/utils";
import type { Entity, NexusWorld } from "@atlasjs/nexus";
import type { OccluderRegion, OccluderStripData } from "@atlasjs/gameplay";

import type { MapCollider } from "./mapMath";
import type { TiledDocument } from "./TiledDocument";
import type { RectObject, ResolvedObject } from "./resolved.types";
import { colliderFromRect } from "./mapMath";

import {
  OccluderStrip,
  TileMap,
  Transform2D,
  bakeOccluderStrips,
} from "@atlasjs/gameplay";

export function isOccluderRegion(obj: ResolvedObject): obj is RectObject {
  return (
    obj.kind === "rect" &&
    (obj.groupPath.includes("OccluderRegions") ||
      obj.properties.occluder === true)
  );
}

export function ingestOccluders(
  nexus: NexusWorld,
  grid: Entity,
  doc: TiledDocument,
  occluderLayerEntities: readonly Entity[],
  scale: number,
  defaultSortingLayer: string,
  logger: Logger,
): void {
  const cellSize: Vec2 = new Vec2(doc.tileWidth, doc.tileHeight);
  const cellGap: Vec2 = new Vec2(0, 0);

  const regions: OccluderRegion[] = [];
  for (const obj of doc.objects) {
    if (!isOccluderRegion(obj)) {
      continue;
    }

    const world: MapCollider = colliderFromRect(obj, scale);
    const slice: "single" | "perRow" =
      obj.properties.slice === "perRow" ? "perRow" : "single";

    const sortingLayer: string =
      typeof obj.properties.sortingLayer === "string"
        ? obj.properties.sortingLayer
        : defaultSortingLayer;

    regions.push({
      slice,
      sortingLayer,
      rowFootYWorld: (cy: number): number => scale * (cy + 1) * cellSize.y,
      footYWorld: world.y + world.height,
      cellBounds: {
        cxMin: Math.floor(obj.x / cellSize.x),
        cyMin: Math.floor(obj.y / cellSize.y),
        cxMax: Math.ceil((obj.x + obj.width) / cellSize.x) - 1,
        cyMax: Math.ceil((obj.y + obj.height) / cellSize.y) - 1,
      },
    });
  }

  if (regions.length === 0) {
    return;
  }

  for (const layerEntity of occluderLayerEntities) {
    const tileMap: TileMap | undefined = nexus.getComponent(
      layerEntity,
      TileMap,
    );

    if (tileMap === undefined) {
      continue;
    }

    let hasAnyTile: boolean = false;

    tileMap.forEachTile(() => {
      hasAnyTile = true;
    });

    let stripCount: number = 0;
    for (const region of regions) {
      const strips: OccluderStripData[] = bakeOccluderStrips(
        region,
        tileMap,
        cellSize,
        cellGap,
      );

      if (strips.length === 0) {
        continue;
      }

      stripCount += strips.length;
      for (const strip of strips) {
        const entity: Entity = nexus.createEntity();
        nexus.addComponent(entity, Transform2D);
        nexus.addComponent(
          entity,
          OccluderStrip,
          strip.footY,
          strip.tiles,
          strip.texture,
          strip.sortingLayer,
        );

        nexus.setParent(entity, grid);
      }
    }

    if (hasAnyTile && stripCount === 0) {
      // prettier-ignore
      logger.warn(`Occluder layer (entity ${layerEntity}) has occluder tiles not covered by any OccluderRegions rectangle; they will not render.`);
    }

    logger.log(`Occluder layer baked into strips (${regions.length} regions).`);
  }
}
