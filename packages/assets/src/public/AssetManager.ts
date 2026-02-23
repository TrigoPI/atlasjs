import { textureHandle } from "./TextureHandle";
import { TextureHandle, TextureMeta } from "./types";

export class AssetManager {
  private readonly textures: Map<TextureHandle, TextureMeta>;

  public constructor() {
    this.textures = new Map<TextureHandle, TextureMeta>();
  }

  public getTextureMeta(handle: TextureHandle): Readonly<TextureMeta> {
    const t: TextureMeta | undefined = this.textures.get(handle);

    if (!t) {
      throw new Error(`AssetManager: unknown texture handle "${handle}"`);
    }

    return t;
  }

  public async loadTexture(id: string, src: string): Promise<TextureHandle> {
    const handle: TextureHandle = textureHandle(id);

    if (this.textures.has(handle)) {
      return handle;
    }

    const img: HTMLImageElement = await this.loadImage(src);

    this.textures.set(handle, {
      src,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      image: img,
    });

    return handle;
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
