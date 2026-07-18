import { AssetLoader } from "@atlasjs/assets";
import { Texture2D } from "../core";
import { NebulaRenderer } from "../NebulaRenderer";
import { TextureAsset } from "./TextureAsset";

export class TextureLoader implements AssetLoader<TextureAsset, Texture2D> {
  public readonly type: string = "texture";
  private readonly nebula: NebulaRenderer;

  public constructor(nebula: NebulaRenderer) {
    this.nebula = nebula;
  }

  public async load(asset: TextureAsset): Promise<Texture2D> {
    const image: HTMLImageElement = new Image();
    image.src = asset.source;
    await image.decode();

    const source: ImageBitmap = await createImageBitmap(image, {
      imageOrientation: "flipY",
    });

    return this.nebula.createTexture2D({
      source,
      width: source.width,
      height: source.height,
      format: asset.format,
    });
  }
}
