import { createLogger, Logger } from "@atlasjs/utils";
import { textureHandle } from "./TextureHandle";
import { TextureHandle } from "./types";
import { Texture2D } from "./Texture2D";

export class AssetManager {
  private readonly logger: Logger;
  private readonly textures: Map<TextureHandle, Texture2D>;

  public constructor() {
    this.textures = new Map<TextureHandle, Texture2D>();
    this.logger = createLogger(AssetManager.name);
  }

  public getTextureMeta(handle: TextureHandle): Readonly<Texture2D> {
    const t: Texture2D | undefined = this.textures.get(handle);

    if (!t) {
      throw new Error(`AssetManager: unknown texture handle "${handle}"`);
    }

    return t;
  }

  public async loadTexture(id: string, src: string): Promise<Texture2D> {
    this.logger.log(`Loading texture "${id}" from "${src}"...`);
    const handle: TextureHandle = textureHandle(id);

    if (this.textures.has(handle)) {
      this.logger.log(`Texture "${id}" is already loaded.`);
      return this.textures.get(handle)!;
    }

    this.logger.log(`Texture "${id}" is not loaded. Loading...`);

    const img: HTMLImageElement = await this.loadImage(src);
    const texture: Texture2D = new Texture2D(handle, img);
    this.textures.set(handle, texture);

    this.logger.log(
      `Texture "${id}" loaded successfully [${texture.width}x${texture.height}]`,
    );

    return texture;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img: HTMLImageElement = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error(`AssetManager: failed to load ${src}`));
    });
  }
}
