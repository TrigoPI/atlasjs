import { AssetLoader, LoadContext } from "@atlasjs/assets";
import { Texture2D } from "@atlasjs/nebula";
import { Sprite } from "./Sprite";
import { SpriteAsset } from "./SpriteAsset";

export class SpriteLoader implements AssetLoader<SpriteAsset, Sprite> {
  public readonly type: string = "sprite";

  public async load(asset: SpriteAsset, ctx: LoadContext): Promise<Sprite> {
    const texture: Texture2D = await ctx.load<Texture2D>(asset.texture);

    return new Sprite(texture, {
      rect: asset.rect,
      pivot: asset.pivot,
      id: asset.id,
    });
  }
}
