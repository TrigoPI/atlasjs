import { Engine, Plugin } from "@atlasjs/core";
import { ASSET_MANAGER } from "./tokens";
import { AssetManager } from "./AssetManager";

export class AssetPlugin extends Plugin {
  private manager: AssetManager | null;

  public constructor() {
    super("asset-plugin", { provides: [ASSET_MANAGER] });
    this.manager = null;
  }

  public install(engine: Engine): void {
    this.manager = new AssetManager();
    engine.services.provide(ASSET_MANAGER, this.manager);
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.manager?.destroy();
    this.manager = null;
  }
}
