import type { MapLoader } from "../map-loader";
import type { SerializedTile } from "../map-loader/map-object";

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
  tilesetName: string;
}> {
  private readonly tilesetName: string;
  private readonly grid: GameEntity;
  private readonly loader: MapLoader;
  private readonly scale: number;

  public onCreate(): void {
    const transform: Transform = this.grid.requireComponent(Transform);
    const tilemap: TileMap = this.requireComponent(TileMap);

    const serializedGroundLayer: SerializedTile[] =
      this.loader.getSerializedLayer(this.tilesetName);

    transform.setScale(this.scale, this.scale);

    for (const tile of serializedGroundLayer) {
      tilemap.setTile(tile.position.cx, tile.position.cy, tile.tileIndex);
    }
  }
}

registerScriptMetadata(MapBuilderScript, {
  exposed: {
    tilesetName: ScriptMetadata.field({ required: true }),
    loader: ScriptMetadata.field({ required: true }),
    scale: ScriptMetadata.field({ required: true }),
    grid: ScriptMetadata.entity({ required: true }),
  },
});
