import { TextureHandle } from "./types";

export class Texture2D {
  public readonly id: TextureHandle;
  public readonly width: number;
  public readonly height: number;
  public readonly image: HTMLImageElement;

  public constructor(id: TextureHandle, image: HTMLImageElement) {
    this.id = id;
    this.image = image;
    this.width = image.naturalWidth || image.width;
    this.height = image.naturalHeight || image.height;
  }
}
