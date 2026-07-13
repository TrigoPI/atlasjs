import { Engine, Plugin } from "@atlasjs/core";
import { AssetManager } from "./AssetManager";
import { ASSETS } from "./Tokens";

export class AssetPlugin extends Plugin {
  private assets: AssetManager | null;

  public constructor() {
    super("asset", { provides: [ASSETS] });
    this.assets = null;
  }

  public install(engine: Engine): void {
    this.assets = new AssetManager();
    engine.services.provide(ASSETS, this.assets);
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.assets = null;
  }
}
