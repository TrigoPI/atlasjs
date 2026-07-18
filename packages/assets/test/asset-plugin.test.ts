import { describe, expect, it } from "vitest";
import { Engine } from "@atlasjs/core";
import { AssetPlugin } from "../src/AssetPlugin";
import { ASSET_MANAGER } from "../src/tokens";
import { AssetManager } from "../src/AssetManager";

describe("AssetPlugin", () => {
  it("provides an AssetManager under ASSET_MANAGER", async () => {
    const engine: Engine = new Engine({ loop: () => (): void => {} });
    engine.use(new AssetPlugin());

    await engine.start();

    const manager: AssetManager = engine.services.get(ASSET_MANAGER);
    expect(manager).toBeInstanceOf(AssetManager);
  });
});
