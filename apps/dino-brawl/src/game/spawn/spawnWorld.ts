import type { SceneContext } from "@atlasjs/core";

import {
  type BuiltMap,
  MapBuilder,
  TiledDocument,
  createGlobTilesetResolver,
  groupNameSortingResolver,
} from "../tiled";
import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, MAP_SCALE } from "../config";

export async function spawnWorld(ctx: SceneContext): Promise<BuiltMap> {
  const doc: TiledDocument = new TiledDocument(ResourcesPath.Map);

  return MapBuilder.build(ctx, doc, {
    resolver: createGlobTilesetResolver(),
    scale: MAP_SCALE,
    resolveSortingLayer: groupNameSortingResolver(
      [SortingLayer.Ground, SortingLayer.Entities, SortingLayer.Overhead],
      { fallback: SortingLayer.Ground },
    ),
    objectSortingLayer: SortingLayer.Entities,
  });
}
