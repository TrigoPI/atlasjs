import { describe, expect, it } from "vitest";
import { Asset } from "../src/Asset";
import { Resource } from "../src/Resource";
import { AssetLoader } from "../src/AssetLoader";
import { LoadContext } from "../src/LoadContext";
import { AssetManager } from "../src/AssetManager";

class FakeResource implements Resource {
  public destroyed: boolean = false;
  public constructor(public readonly id: string) {}
  public destroy(): void {
    this.destroyed = true;
  }
}

class CountingLoader implements AssetLoader<Asset, FakeResource> {
  public readonly type: string = "fake";
  public calls: number = 0;
  public async load(asset: Asset): Promise<FakeResource> {
    this.calls++;
    return new FakeResource(asset.id);
  }
}

class ThrowingLoader implements AssetLoader<Asset, FakeResource> {
  public readonly type: string = "boom";
  public calls: number = 0;
  public async load(asset: Asset): Promise<FakeResource> {
    this.calls++;
    throw new Error("nope");
  }
}

class CompositeLoader implements AssetLoader<Asset, FakeResource> {
  public readonly type: string = "composite";
  public constructor(private readonly dep: Asset) {}
  public async load(asset: Asset, ctx: LoadContext): Promise<FakeResource> {
    await ctx.load<FakeResource>(this.dep);
    return new FakeResource(asset.id);
  }
}

const asset = (type: string, id: string): Asset => ({ type, id });

describe("AssetManager", () => {
  it("loads through the loader registered for the asset type", async () => {
    const manager: AssetManager = new AssetManager();
    manager.register(new CountingLoader());

    const resource: FakeResource = await manager.load<FakeResource>(asset("fake", "a"));

    expect(resource.id).toBe("a");
  });

  it("dedups by id: two loads return the same instance, loader runs once", async () => {
    const manager: AssetManager = new AssetManager();
    const loader: CountingLoader = new CountingLoader();
    manager.register(loader);

    const first: FakeResource = await manager.load<FakeResource>(asset("fake", "a"));
    const second: FakeResource = await manager.load<FakeResource>(asset("fake", "a"));

    expect(second).toBe(first);
    expect(loader.calls).toBe(1);
  });

  it("dedups concurrent loads of the same id", async () => {
    const manager: AssetManager = new AssetManager();
    const loader: CountingLoader = new CountingLoader();
    manager.register(loader);

    const [a, b] = await Promise.all([
      manager.load<FakeResource>(asset("fake", "a")),
      manager.load<FakeResource>(asset("fake", "a")),
    ]);

    expect(a).toBe(b);
    expect(loader.calls).toBe(1);
  });

  it("get returns the resolved resource, undefined otherwise", async () => {
    const manager: AssetManager = new AssetManager();
    manager.register(new CountingLoader());

    expect(manager.get("a")).toBeUndefined();
    await manager.load<FakeResource>(asset("fake", "a"));
    expect(manager.get<FakeResource>("a")?.id).toBe("a");
  });

  it("rejects when no loader is registered for the type", async () => {
    const manager: AssetManager = new AssetManager();
    await expect(manager.load(asset("missing", "a"))).rejects.toThrow(/missing/);
  });

  it("propagates loader failures and allows a retry", async () => {
    const manager: AssetManager = new AssetManager();
    const loader: ThrowingLoader = new ThrowingLoader();
    manager.register(loader);

    await expect(manager.load(asset("boom", "a"))).rejects.toThrow("nope");
    await expect(manager.load(asset("boom", "a"))).rejects.toThrow("nope");
    expect(loader.calls).toBe(2);
  });

  it("throws when registering two loaders for the same type", () => {
    const manager: AssetManager = new AssetManager();
    manager.register(new CountingLoader());
    expect(() => manager.register(new CountingLoader())).toThrow(/fake/);
  });

  it("composes dependencies through the load context, deduped", async () => {
    const manager: AssetManager = new AssetManager();
    const dep: CountingLoader = new CountingLoader();
    manager.register(dep);
    manager.register(new CompositeLoader(asset("fake", "shared")));

    await manager.load<FakeResource>(asset("composite", "x"));
    await manager.load<FakeResource>(asset("composite", "y"));

    expect(dep.calls).toBe(1);
  });

  it("destroy disposes every loaded resource", async () => {
    const manager: AssetManager = new AssetManager();
    manager.register(new CountingLoader());
    const resource: FakeResource = await manager.load<FakeResource>(asset("fake", "a"));

    manager.destroy();

    expect(resource.destroyed).toBe(true);
    expect(manager.get("a")).toBeUndefined();
  });
});
