import { Asset } from "./Asset";
import { Resource } from "./Resource";
import { AssetLoader } from "./AssetLoader";
import { LoadContext } from "./LoadContext";

export class AssetManager implements LoadContext {
  private readonly loaders: Map<string, AssetLoader<Asset, Resource>>;
  private readonly loading: Map<string, Promise<Resource>>;
  private readonly loaded: Map<string, Resource>;

  public constructor() {
    this.loaders = new Map<string, AssetLoader<Asset, Resource>>();
    this.loading = new Map<string, Promise<Resource>>();
    this.loaded = new Map<string, Resource>();
  }

  public register<A extends Asset, R extends Resource>(
    loader: AssetLoader<A, R>,
  ): void {
    if (this.loaders.has(loader.type)) {
      throw new Error(
        `An asset loader is already registered for type "${loader.type}".`,
      );
    }

    this.loaders.set(
      loader.type,
      loader as unknown as AssetLoader<Asset, Resource>,
    );
  }

  public load<R extends Resource>(asset: Asset): Promise<R> {
    const pending: Promise<Resource> | undefined = this.loading.get(asset.id);

    if (pending) {
      return pending as Promise<R>;
    }

    const loader: AssetLoader<Asset, Resource> | undefined = this.loaders.get(
      asset.type,
    );

    if (!loader) {
      return Promise.reject(
        new Error(
          `No asset loader registered for type "${asset.type}" (asset "${asset.id}").`,
        ),
      );
    }

    const promise: Promise<Resource> = loader
      .load(asset, this)
      .then((resource: Resource): Resource => {
        this.loaded.set(asset.id, resource);
        return resource;
      });

    this.loading.set(asset.id, promise);
    promise.catch((): void => {
      this.loading.delete(asset.id);
    });

    return promise as Promise<R>;
  }

  public get<R extends Resource>(id: string): R | undefined {
    return this.loaded.get(id) as R | undefined;
  }

  public destroy(): void {
    for (const resource of this.loaded.values()) {
      resource.destroy();
    }

    this.loaded.clear();
    this.loading.clear();
    this.loaders.clear();
  }
}
