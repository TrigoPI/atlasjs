import { AssetManager, type Asset, type Resource } from "@atlasjs/assets";
import { TextureAsset, type Texture2D } from "@atlasjs/nebula";
import { AudioClip, AudioClipAsset } from "@atlasjs/audio";
import { createLogger, Logger } from "@atlasjs/utils";
import { Sprite, SpriteAsset } from "@atlasjs/gameplay";

export type AssetLoadCallback = () => void;
export type AssetDescriptor = { name: string; asset: Asset };

type AssetAtlas = Record<string, Resource>;

export class AssetsLoader {
  private onAssetLoadedCb: AssetLoadCallback | undefined;

  private readonly audios: AssetDescriptor[];
  private readonly textures: AssetDescriptor[];
  private readonly sprites: AssetDescriptor[];

  private readonly logger: Logger;
  private readonly asset: AssetManager;

  private readonly atlas: AssetAtlas;

  public constructor(asset: AssetManager) {
    this.onAssetLoadedCb = undefined;
    this.logger = createLogger(AssetsLoader.name);

    this.asset = asset;
    this.audios = [];
    this.textures = [];
    this.sprites = [];
    this.atlas = {};
  }

  public getAsset<T extends Resource>(name: string): T {
    const asset = this.atlas[name];
    if (!asset) throw new Error(`Asset not found: ${name}`);
    return asset as T;
  }

  public onAssetLoaded(callback: AssetLoadCallback): void {
    this.onAssetLoadedCb = callback;
  }

  public addAudio(name: string, audio: string): AssetsLoader {
    this.audios.push({ name, asset: new AudioClipAsset(audio) });
    return this;
  }

  public addTexture(name: string, texture: string): AssetsLoader {
    this.textures.push({ name, asset: new TextureAsset(texture) });
    return this;
  }

  public addSprite(name: string, sprite: string): AssetsLoader {
    this.sprites.push({ name, asset: SpriteAsset.fromPath(sprite) });
    return this;
  }

  public async load(): Promise<void> {
    await this.loadAudios();
    await this.loadTextures();
    await this.loadSprites();

    this.logger.log("All assets loaded successfully.");
    this.onAssetLoadedCb?.();
  }

  private async loadAudios(): Promise<void> {
    for (const desc of this.audios) {
      this.atlas[desc.name] = await this.asset.load<AudioClip>(desc.asset);
      this.logger.log(`Loaded audio: ${desc.name}`);
    }
  }

  private async loadTextures(): Promise<void> {
    for (const desc of this.textures) {
      this.atlas[desc.name] = await this.asset.load<Texture2D>(desc.asset);
      this.logger.log(`Loaded texture: ${desc.name}`);
    }
  }

  private async loadSprites(): Promise<void> {
    for (const desc of this.sprites) {
      await this.asset.load<Sprite>(desc.asset);
      this.atlas[desc.name] = await this.asset.load<Sprite>(desc.asset);
      this.logger.log(`Loaded sprite: ${desc.name}`);
    }
  }
}
