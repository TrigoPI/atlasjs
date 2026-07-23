import type { AssetLoader, LoadContext } from "@atlasjs/assets";
import type { Texture2D } from "@atlasjs/nebula";
import { TileSet } from "./TileSet";
import type { TileSetAsset } from "./TileSetAsset";

export class TileSetLoader implements AssetLoader<TileSetAsset, TileSet> {
  public readonly type: string = "tileset";

  public async load(asset: TileSetAsset, ctx: LoadContext): Promise<TileSet> {
    const texture: Texture2D = await ctx.load<Texture2D>(asset.texture);

    return new TileSet(texture, {
      tileWidth: asset.tileWidth,
      tileHeight: asset.tileHeight,
      columns: asset.columns,
      rows: asset.rows,
      spacing: asset.spacing,
      margin: asset.margin,
      pivot: asset.pivot,
      id: asset.id,
    });
  }
}
