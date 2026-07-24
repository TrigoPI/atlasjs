import type { MapLoader, SerializedTile } from "../map-loader";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  TileMap,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

export class MapBuilderScript extends AtlasScript<{
  loader: MapLoader;
  scale: number;
  grid: GameEntity;
}> {
  private readonly grid: GameEntity;
  private readonly loader: MapLoader;
  private readonly scale: number;

  public onCreate(): void {
    const transform: Transform = this.grid.requireComponent(Transform);
    const tilemap: TileMap = this.requireComponent(TileMap);
    const serializedLayer: SerializedTile[] =
      this.loader.getSerializedLayer("ground_layer");

    transform.setScale(this.scale, this.scale);

    for (const tile of serializedLayer) {
      tilemap.setTile(tile.position.cx, tile.position.cy, tile.tileIndex);
    }
  }
}

registerScriptMetadata(MapBuilderScript, {
  exposed: {
    loader: ScriptMetadata.field({ required: true }),
    scale: ScriptMetadata.field({ required: true }),
    grid: ScriptMetadata.entity({ required: true }),
  },
});
