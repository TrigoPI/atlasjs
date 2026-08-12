import type { SceneContext } from "@atlasjs/core";

import { ResourcesPath } from "../loaders/ResourcesPath";
import { SortingLayer, MAP_SCALE } from "../config";

import {
  type BuiltMap,
  MapBuilder,
  TiledDocument,
  createGlobTilesetResolver,
  groupNameSortingResolver,
} from "../tiled";

export async function spawnWorld(ctx: SceneContext): Promise<BuiltMap> {
  const doc: TiledDocument = new TiledDocument(ResourcesPath.Map);

  return MapBuilder.build(ctx, doc, {
    scale: MAP_SCALE,
    objectSortingLayer: SortingLayer.Entities,
    resolver: createGlobTilesetResolver(),
    resolveSortingLayer: groupNameSortingResolver(
      [SortingLayer.Ground, SortingLayer.Entities, SortingLayer.Overhead],
      { fallback: SortingLayer.Ground },
    ),
  });
}
