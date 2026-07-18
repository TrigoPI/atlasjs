# Asset System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a serializable-descriptor ↔ runtime-handle asset model (`Asset`/`Resource` + `AssetManager` + per-type loaders) and migrate texture/sprite loading onto it, killing the app-level manual loader.

**Architecture:** `@atlasjs/assets` stays a generic leaf: it owns the `Asset` (descriptor) and `Resource` (handle) contracts, the `AssetLoader` seam, the `AssetManager` orchestrator (async, cache/dedup by `id`, dependency composition), and an `AssetPlugin` providing the manager under a service token. Domain packages register their own loaders via the plugin dependency system: nebula contributes `TextureAsset`/`TextureLoader` (and makes `Texture2D` a `Resource`); gameplay contributes `SpriteAsset`/`SpriteLoader` (and makes its `Sprite` handle a `Resource`). A companion mechanical rename resolves the `Sprite` name collision by suffixing every nebula scene-graph node with `*Node`.

**Tech Stack:** TypeScript (strict), pnpm workspaces + Turborepo, tsdown (build → `dist`), vitest (tests). Design source: [`docs/assets/asset-system.md`](asset-system.md).

## Global Constraints

- **Always type the code**, even trivially: function parameters, variables, and class fields all carry explicit types. (Project rule, verbatim.)
- **No comments** in code. (Project rule, verbatim.)
- **Typecheck with `tsc --noEmit`**, never `tsc -b` (it emits artifacts next to sources). (Project rule, verbatim.)
- **After changing a package's public API, rebuild its `dist`** (`pnpm --filter <pkg> build`) before any dependent package typechecks, tests, or the sandbox vite preview resolves it. Package exports point at `dist`, not `src`.
- **Do NOT commit.** End each task at green verification and hand off; the user reviews and commits each step themselves.
- Dependency direction stays acyclic: `@atlasjs/assets` depends only on `@atlasjs/core` + `@atlasjs/utils`; `nebula` and `gameplay` may depend on `assets`; `assets` never imports a backend.

---

### Task 1: Rename scene-graph nodes to `*Node` (nebula + consumers)

> ✅ Done — committed `59ac306`, review clean.

Mechanical rename, no behavior change. Resolves the `Sprite` (node) ↔ `Sprite` (asset) collision at the source. Land it first, in isolation.

**Files:**
- Rename: `packages/nebula/src/graphics/{Sprite,Shape,Rect,Circle,Line}.ts` → `{SpriteNode,ShapeNode,RectNode,CircleNode,LineNode}.ts`
- Modify: `packages/nebula/src/graphics/index.ts`
- Modify: `packages/nebula/src/renderers/SpriteRenderer.ts`, `packages/nebula/src/renderers/ShapeRenderer.ts`
- Modify: `packages/nebula/src/animations/AnimationPlayer.ts`, `packages/nebula/src/animations/SpriteAnimation.ts`
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts`
- Modify: `apps/webgpu/src/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nebula exports `SpriteNode`, `ShapeNode`, `RectNode`, `CircleNode`, `LineNode` (replacing `Sprite`, `Shape`, `Rect`, `Circle`, `Line`). `Node` and `Transformable` keep their names.

- [x] **Step 1: Rename the graphics files**

```bash
cd packages/nebula/src/graphics
git mv Sprite.ts SpriteNode.ts
git mv Shape.ts ShapeNode.ts
git mv Rect.ts RectNode.ts
git mv Circle.ts CircleNode.ts
git mv Line.ts LineNode.ts
```

- [x] **Step 2: Rename the classes and their internal references**

In each renamed file, replace the old class identifier with the new one everywhere it appears — the `class` declaration, `extends`, and every self-referential return type. Concretely:

- `SpriteNode.ts`: `export class SpriteNode extends Node`; every method returning `: Sprite` becomes `: SpriteNode` (`setTint`, `setBlend`, `flipX`, `flipY`, `setSourceRect`, `setFrame`, `setAnchor`).
- `ShapeNode.ts`: `export class ShapeNode extends Node`.
- `RectNode.ts`: `import { ShapeNode } from "./ShapeNode";` · `export class RectNode extends ShapeNode`; `setSize(...): Rect` becomes `: RectNode`.
- `CircleNode.ts`: `import { ShapeNode } from "./ShapeNode";` · `export class CircleNode extends ShapeNode`.
- `LineNode.ts`: `import { ShapeNode } from "./ShapeNode";` · `export class LineNode extends ShapeNode`.

- [x] **Step 3: Update the graphics barrel**

`packages/nebula/src/graphics/index.ts`:

```ts
export * from "./CircleNode";
export * from "./LineNode";
export * from "./Node";
export * from "./RectNode";
export * from "./ShapeNode";
export * from "./SpriteNode";
export * from "./Transformable";
export * from "./graphics-types";
```

- [x] **Step 4: Update the nebula renderers**

`packages/nebula/src/renderers/SpriteRenderer.ts`: change the import to `import { Node, SpriteNode } from "../graphics";`, the base to `NodeRendererBase<SpriteNode, SpriteRenderData>`, `node instanceof SpriteNode`, and every `Sprite` type annotation/cast (`node as SpriteNode`, `sprite: SpriteNode`) accordingly.

`packages/nebula/src/renderers/ShapeRenderer.ts`: change the import to `import { Node, ShapeNode, RectNode, CircleNode, LineNode } from "../graphics";`, the base to `NodeRendererBase<ShapeNode, ShapeRenderData>`, `node instanceof ShapeNode`, `shape instanceof CircleNode`, `shape instanceof RectNode`, `shape instanceof LineNode`, and every `Shape`/`Line` type annotation (`shape: ShapeNode`, `line: LineNode`) accordingly.

- [x] **Step 5: Update the nebula animations**

`packages/nebula/src/animations/AnimationPlayer.ts`: `import { SpriteNode } from "../graphics";` and `public updateAndApply(sprite: SpriteNode, deltaMs: number): void`.

`packages/nebula/src/animations/SpriteAnimation.ts`: `import { SpriteNode } from "../graphics";` and `public updateAndApply(sprite: SpriteNode, deltaMs: number): void`.

- [x] **Step 6: Typecheck, test and build nebula**

Run: `pnpm --filter @atlasjs/nebula exec tsc --noEmit`
Expected: no output (exit 0).

Run: `pnpm --filter @atlasjs/nebula test`
Expected: all test files pass.

Run: `pnpm --filter @atlasjs/nebula build`
Expected: tsdown writes `dist` with no errors (regenerates the renamed exports for downstream packages).

- [x] **Step 7: Update the gameplay consumer**

`packages/gameplay/src/systems/SpriteRenderSystem.ts`: replace the aliased import with a direct one. The nebula import block becomes:

```ts
import {
  Color,
  NebulaRenderer,
  Sampler,
  SpriteNode,
} from "@atlasjs/nebula";
```

The `import { Sprite } from "../assets";` line (the gameplay asset handle) stays unchanged — only the nebula alias goes away. `MountedSprite.node` is already typed `SpriteNode`, so no other edits are needed here.

- [x] **Step 8: Update the webgpu demo**

`apps/webgpu/src/index.ts`: in the `@atlasjs/nebula` import, replace `Sprite, Rect, Circle, Line` with `SpriteNode, RectNode, CircleNode, LineNode`. Update the four construction sites and their type annotations:

```ts
const dinoSprite: SpriteNode = new SpriteNode(dinoTexture, sampler);
const swordSprite: SpriteNode = new SpriteNode(swordTexture, sampler);
const sealionSprite: SpriteNode = new SpriteNode(sealionTexture);
// ...
const bgRect: RectNode = new RectNode(320, 240);
// ...
const circle: CircleNode = new CircleNode(70);
// ...
const line: LineNode = new LineNode(80, 320, 360, 250, 1);
```

- [x] **Step 9: Verify downstream and hand off**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit -p tsconfig.test.json`
Expected: no output (exit 0).

Run: `pnpm --filter webgpu exec tsc --noEmit`
Expected: no output (exit 0).

Do not commit — hand the diff to the user for review.

---

### Task 2: `@atlasjs/assets` — contracts + `AssetManager`

> ✅ Done — committed `245f5f9`, review clean.

**Files:**
- Modify: `packages/assets/package.json` (add `test` script)
- Create: `packages/assets/vitest.config.ts`
- Modify: `packages/assets/src/Asset.ts` (rewrite as descriptor)
- Create: `packages/assets/src/Resource.ts`, `packages/assets/src/LoadContext.ts`, `packages/assets/src/AssetLoader.ts`, `packages/assets/src/AssetManager.ts`
- Modify: `packages/assets/src/index.ts`
- Test: `packages/assets/test/asset-manager.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Asset { readonly type: string; readonly id: string }`
  - `interface Resource { readonly id: string; destroy(): void }`
  - `interface LoadContext { load<R extends Resource>(asset: Asset): Promise<R> }`
  - `interface AssetLoader<A extends Asset, R extends Resource> { readonly type: string; load(asset: A, ctx: LoadContext): Promise<R> }`
  - `class AssetManager implements LoadContext` with `register<A,R>(loader): void`, `load<R>(asset): Promise<R>`, `get<R>(id): R | undefined`, `destroy(): void`.

- [x] **Step 1: Add the test runner to the package**

`packages/assets/package.json` — add a `test` script alongside the existing ones:

```json
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest run",
    "clean": "rimraf dist"
  },
```

Create `packages/assets/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [x] **Step 2: Write the contract files**

`packages/assets/src/Asset.ts` (replace the whole file):

```ts
export interface Asset {
  readonly type: string;
  readonly id: string;
}
```

`packages/assets/src/Resource.ts`:

```ts
export interface Resource {
  readonly id: string;
  destroy(): void;
}
```

`packages/assets/src/LoadContext.ts`:

```ts
import { Asset } from "./Asset";
import { Resource } from "./Resource";

export interface LoadContext {
  load<R extends Resource>(asset: Asset): Promise<R>;
}
```

`packages/assets/src/AssetLoader.ts`:

```ts
import { Asset } from "./Asset";
import { Resource } from "./Resource";
import { LoadContext } from "./LoadContext";

export interface AssetLoader<A extends Asset, R extends Resource> {
  readonly type: string;
  load(asset: A, ctx: LoadContext): Promise<R>;
}
```

- [x] **Step 3: Write the failing `AssetManager` test**

`packages/assets/test/asset-manager.test.ts`:

```ts
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
```

- [x] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/assets test`
Expected: FAIL — `Failed to resolve import "../src/AssetManager"` (file does not exist yet).

- [x] **Step 5: Implement `AssetManager`**

`packages/assets/src/AssetManager.ts`:

```ts
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
```

- [x] **Step 6: Update the barrel**

`packages/assets/src/index.ts`:

```ts
export * from "./Asset";
export * from "./Resource";
export * from "./LoadContext";
export * from "./AssetLoader";
export * from "./AssetManager";
```

- [x] **Step 7: Run tests, typecheck, build**

Run: `pnpm --filter @atlasjs/assets test`
Expected: PASS — 9 tests in `asset-manager.test.ts`.

Run: `pnpm --filter @atlasjs/assets exec tsc --noEmit`
Expected: no output (exit 0).

Run: `pnpm --filter @atlasjs/assets build`
Expected: tsdown writes `dist` with no errors.

- [x] **Step 8: Hand off** — do not commit; hand the diff to the user for review.

---

### Task 3: `@atlasjs/assets` — `AssetPlugin` + service token

**Files:**
- Create: `packages/assets/src/tokens.ts`, `packages/assets/src/AssetPlugin.ts`
- Modify: `packages/assets/src/index.ts`
- Test: `packages/assets/test/asset-plugin.test.ts`

**Interfaces:**
- Consumes: `AssetManager` (Task 2); `Engine`, `Plugin`, `ServiceRegistry`, `ServiceToken` from `@atlasjs/core`.
- Produces: `ASSET_MANAGER: ServiceToken<AssetManager>` and `class AssetPlugin extends Plugin` (`provides: [ASSET_MANAGER]`).

- [x] **Step 1: Write the token and plugin**

`packages/assets/src/tokens.ts`:

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { AssetManager } from "./AssetManager";

export const ASSET_MANAGER: ServiceToken<AssetManager> =
  ServiceRegistry.createToken<AssetManager>("ASSET_MANAGER");
```

`packages/assets/src/AssetPlugin.ts`:

```ts
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
```

- [x] **Step 2: Write the failing plugin test**

`packages/assets/test/asset-plugin.test.ts`:

```ts
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
```

- [x] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/assets test asset-plugin`
Expected: FAIL — `Failed to resolve import "../src/AssetPlugin"`.

- [x] **Step 4: Export from the barrel to make it resolve**

`packages/assets/src/index.ts` — append:

```ts
export * from "./tokens";
export * from "./AssetPlugin";
```

- [x] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/assets test`
Expected: PASS — both `asset-manager.test.ts` and `asset-plugin.test.ts`.

- [x] **Step 6: Typecheck and build**

Run: `pnpm --filter @atlasjs/assets exec tsc --noEmit`
Expected: no output (exit 0).

Run: `pnpm --filter @atlasjs/assets build`
Expected: `dist` regenerated (now exports `AssetPlugin` + `ASSET_MANAGER` for downstream packages).

- [ ] **Step 7: Hand off** — do not commit; hand the diff to the user for review.

---

### Task 4: `@atlasjs/nebula` — `TextureAsset` + `TextureLoader` + `Texture2D` as `Resource` + plugin wiring

**Files:**
- Modify: `packages/nebula/package.json` (add `@atlasjs/assets` dependency)
- Modify: `packages/nebula/src/core/resources/Texture2D.ts`
- Create: `packages/nebula/src/assets/TextureAsset.ts`, `packages/nebula/src/assets/TextureLoader.ts`, `packages/nebula/src/assets/index.ts`
- Modify: `packages/nebula/src/index.ts`, `packages/nebula/src/NebulaPlugin.ts`
- Test: `packages/nebula/test/TextureAsset.test.ts`

**Interfaces:**
- Consumes: `Asset`, `AssetLoader`, `AssetManager`, `ASSET_MANAGER` from `@atlasjs/assets`; `Texture2D`, `TextureFormat`, `Texture2DDescriptor` from `../core`; `NebulaRenderer`.
- Produces:
  - `class TextureAsset implements Asset` with `type = "texture"`, `id`, `source: string`, `format?: TextureFormat`, ctor `(source: string, options?: { id?: string; format?: TextureFormat })`, default `id = "texture:" + source`.
  - `class TextureLoader implements AssetLoader<TextureAsset, Texture2D>` (`type = "texture"`).
  - `Texture2D extends Resource` (already carries `id` + `destroy()`).

- [ ] **Step 1: Add the assets dependency**

`packages/nebula/package.json` — add to `dependencies` (alphabetical, before `@atlasjs/core`):

```json
    "@atlasjs/assets": "workspace:*",
```

Then run: `pnpm install`
Expected: workspace link created, no errors.

- [ ] **Step 2: Make `Texture2D` a `Resource`**

`packages/nebula/src/core/resources/Texture2D.ts` (replace the whole file):

```ts
import { Resource } from "@atlasjs/assets";

export interface Texture2D extends Resource {
  readonly __kind: string;
  readonly width: number;
  readonly height: number;
}
```

(`id` and `destroy()` now come from `Resource`; `Resource.destroy()` is signature-compatible with the previous `Disposable`.)

- [ ] **Step 3: Write the failing `TextureAsset` test**

`packages/nebula/test/TextureAsset.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TextureAsset } from "../src/assets/TextureAsset";

describe("TextureAsset", () => {
  it("has type 'texture' and derives its id from the source", () => {
    const asset: TextureAsset = new TextureAsset("game/dino.png");

    expect(asset.type).toBe("texture");
    expect(asset.id).toBe("texture:game/dino.png");
    expect(asset.source).toBe("game/dino.png");
  });

  it("accepts an explicit id and format", () => {
    const asset: TextureAsset = new TextureAsset("x.png", {
      id: "hero",
      format: "rgba8unorm",
    });

    expect(asset.id).toBe("hero");
    expect(asset.format).toBe("rgba8unorm");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/assets build` (ensure the `Resource` export used by `Texture2D` is in `dist`), then `pnpm --filter @atlasjs/nebula test TextureAsset`
Expected: FAIL — `Failed to resolve import "../src/assets/TextureAsset"`.

- [ ] **Step 5: Implement `TextureAsset` and `TextureLoader`**

`packages/nebula/src/assets/TextureAsset.ts`:

```ts
import { Asset } from "@atlasjs/assets";
import { TextureFormat } from "../core";

export interface TextureAssetOptions {
  readonly id?: string;
  readonly format?: TextureFormat;
}

export class TextureAsset implements Asset {
  public readonly type: string = "texture";
  public readonly id: string;
  public readonly source: string;
  public readonly format?: TextureFormat;

  public constructor(source: string, options?: TextureAssetOptions) {
    this.source = source;
    this.format = options?.format;
    this.id = options?.id ?? `texture:${source}`;
  }
}
```

`packages/nebula/src/assets/TextureLoader.ts`:

```ts
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
```

`packages/nebula/src/assets/index.ts`:

```ts
export * from "./TextureAsset";
export * from "./TextureLoader";
```

- [ ] **Step 6: Export the assets folder and run the test**

`packages/nebula/src/index.ts` — add after `export * from "./graphics";`:

```ts
export * from "./assets";
```

Run: `pnpm --filter @atlasjs/nebula test TextureAsset`
Expected: PASS — 2 tests.

- [ ] **Step 7: Wire the loader into `NebulaPlugin`**

`packages/nebula/src/NebulaPlugin.ts`:
- Add imports:

```ts
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";
import { TextureLoader } from "./assets";
```

- Change the `super(...)` call to declare the dependency:

```ts
    super("nebula-plugin", { provides: [NEBULA_RENDERER], requires: [ASSET_MANAGER] });
```

- At the top of `install`, resolve the manager and register the loader after the renderer exists:

```ts
  public async install(engine: Engine): Promise<void> {
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);

    const renderer: NebulaRenderer = new NebulaRenderer(this.renderer);
    await renderer.init();

    assets.register(new TextureLoader(renderer));

    this.renderStep = engine.scheduler.render.add(() => renderer.render(), {
      name: "nebula:render",
      stage: "Main",
    });

    engine.services.provide(NEBULA_RENDERER, renderer);

    this.logger.log("Nebula Plugin installed");
    this.deferred.resolve();
  }
```

- [ ] **Step 8: Typecheck, test, build nebula**

Run: `pnpm --filter @atlasjs/nebula exec tsc --noEmit`
Expected: no output (exit 0).

Run: `pnpm --filter @atlasjs/nebula test`
Expected: all tests pass (existing suites + `TextureAsset.test.ts`).

Run: `pnpm --filter @atlasjs/nebula build`
Expected: `dist` regenerated (exports `TextureAsset`/`TextureLoader`, `Texture2D` now a `Resource`).

- [ ] **Step 9: Hand off** — do not commit; hand the diff to the user for review.

---

### Task 5: `@atlasjs/gameplay` — `SpriteAsset` + `SpriteLoader` + `Sprite` as `Resource` + plugin/harness wiring

**Files:**
- Modify: `packages/gameplay/src/assets/Sprite.ts`
- Create: `packages/gameplay/src/assets/SpriteAsset.ts`, `packages/gameplay/src/assets/SpriteLoader.ts`
- Modify: `packages/gameplay/src/assets/index.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`, `packages/gameplay/test/helpers/harness.ts`
- Modify: `packages/gameplay/test/sprite-asset.test.ts`
- Test: `packages/gameplay/test/sprite-asset-loader.test.ts`

**Interfaces:**
- Consumes: `Resource`, `Asset`, `AssetLoader`, `LoadContext`, `AssetManager`, `ASSET_MANAGER`, `AssetPlugin` from `@atlasjs/assets`; `TextureAsset`, `Texture2D` from `@atlasjs/nebula`; `Bound`, `Vec2` from `@atlasjs/math`.
- Produces:
  - `class Sprite implements Resource` (handle): `id`, `texture: Texture2D`, `rect: Bound`, `pivot: Vec2`, `destroy()` no-op (no more `kind`/`dispose`).
  - `class SpriteAsset implements Asset` with `type = "sprite"`, `id`, `texture: TextureAsset`, `rect?: Bound`, `pivot?: Vec2`.
  - `class SpriteLoader implements AssetLoader<SpriteAsset, Sprite>` (`type = "sprite"`).

- [ ] **Step 1: Turn the `Sprite` handle into a `Resource`**

`packages/gameplay/src/assets/Sprite.ts` (replace the whole file):

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "@atlasjs/nebula";
import type { Resource } from "@atlasjs/assets";

export interface SpriteOptions {
  rect?: Bound;
  pivot?: Vec2;
  id?: string;
}

export class Sprite implements Resource {
  public readonly id: string;
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  // prettier-ignore
  public constructor(texture: Texture2D, options?: SpriteOptions) {
    this.texture = texture;
    this.pivot = options?.pivot?.clone() ?? new Vec2(0.5, 0.5);
    this.rect = options?.rect?.clone() ?? new Bound(0, 0, texture.width, texture.height);

    this.id =
      options?.id ??
      `sprite:${texture.id}:${this.rect.x}:${this.rect.y}:${this.rect.width}:${this.rect.height}`;
  }

  public destroy(): void {}
}
```

- [ ] **Step 2: Fix the existing `Sprite` handle test**

`packages/gameplay/test/sprite-asset.test.ts`:
- Remove the `kind` assertion (line `expect(sprite.kind).toBe("sprite");`).
- Rename the last `it` title to `"accepts an explicit id and has a no-op destroy"` and change its body to call `destroy`:

```ts
  it("accepts an explicit id and has a no-op destroy", () => {
    const sprite: Sprite = new Sprite(fakeTexture(), { id: "hero" });

    expect(sprite.id).toBe("hero");
    expect(() => sprite.destroy()).not.toThrow();
  });
```

- [ ] **Step 3: Write the failing descriptor + loader test**

`packages/gameplay/test/sprite-asset-loader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Asset, LoadContext, Resource } from "@atlasjs/assets";
import { TextureAsset, Texture2D } from "@atlasjs/nebula";
import { SpriteAsset } from "../src/assets/SpriteAsset";
import { SpriteLoader } from "../src/assets/SpriteLoader";
import { Sprite } from "../src/assets/Sprite";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteAsset", () => {
  it("has type 'sprite' and derives its id from texture + rect + pivot", () => {
    const texture: TextureAsset = new TextureAsset("dino.png");
    const asset: SpriteAsset = new SpriteAsset(texture);

    expect(asset.type).toBe("sprite");
    expect(asset.id).toBe("sprite:texture:dino.png:full:center");
    expect(asset.texture).toBe(texture);
  });

  it("accepts an explicit id", () => {
    const asset: SpriteAsset = new SpriteAsset(new TextureAsset("x.png"), {
      id: "hero",
    });

    expect(asset.id).toBe("hero");
  });
});

describe("SpriteLoader", () => {
  it("resolves the texture via the context then builds a Sprite handle", async () => {
    const texture: Texture2D = fakeTexture("dino", 64, 32);
    const ctx: LoadContext = {
      load: async <R extends Resource>(_asset: Asset): Promise<R> =>
        texture as unknown as R,
    };
    const loader: SpriteLoader = new SpriteLoader();
    const asset: SpriteAsset = new SpriteAsset(new TextureAsset("dino.png"), {
      id: "hero",
    });

    const sprite: Sprite = await loader.load(asset, ctx);

    expect(sprite).toBeInstanceOf(Sprite);
    expect(sprite.texture).toBe(texture);
    expect(sprite.id).toBe("hero");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/assets build && pnpm --filter @atlasjs/nebula build` (so gameplay resolves the new `@atlasjs/assets` and `@atlasjs/nebula` APIs from `dist`), then `pnpm --filter @atlasjs/gameplay test sprite-asset-loader`
Expected: FAIL — `Failed to resolve import "../src/assets/SpriteAsset"`.

- [ ] **Step 5: Implement `SpriteAsset` and `SpriteLoader`**

`packages/gameplay/src/assets/SpriteAsset.ts`:

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import { Asset } from "@atlasjs/assets";
import { TextureAsset } from "@atlasjs/nebula";

export interface SpriteAssetOptions {
  readonly rect?: Bound;
  readonly pivot?: Vec2;
  readonly id?: string;
}

export class SpriteAsset implements Asset {
  public readonly type: string = "sprite";
  public readonly id: string;
  public readonly texture: TextureAsset;
  public readonly rect?: Bound;
  public readonly pivot?: Vec2;

  // prettier-ignore
  public constructor(texture: TextureAsset, options?: SpriteAssetOptions) {
    this.texture = texture;
    this.rect = options?.rect?.clone();
    this.pivot = options?.pivot?.clone();

    const rectKey: string = this.rect
      ? `${this.rect.x}:${this.rect.y}:${this.rect.width}:${this.rect.height}`
      : "full";
    const pivotKey: string = this.pivot ? `${this.pivot.x}:${this.pivot.y}` : "center";

    this.id = options?.id ?? `sprite:${texture.id}:${rectKey}:${pivotKey}`;
  }
}
```

`packages/gameplay/src/assets/SpriteLoader.ts`:

```ts
import { AssetLoader, LoadContext } from "@atlasjs/assets";
import { Texture2D } from "@atlasjs/nebula";
import { Sprite } from "./Sprite";
import { SpriteAsset } from "./SpriteAsset";

export class SpriteLoader implements AssetLoader<SpriteAsset, Sprite> {
  public readonly type: string = "sprite";

  public async load(asset: SpriteAsset, ctx: LoadContext): Promise<Sprite> {
    const texture: Texture2D = await ctx.load<Texture2D>(asset.texture);

    return new Sprite(texture, {
      rect: asset.rect,
      pivot: asset.pivot,
      id: asset.id,
    });
  }
}
```

- [ ] **Step 6: Update the gameplay assets barrel**

`packages/gameplay/src/assets/index.ts`:

```ts
export * from "./Sprite";
export * from "./SpriteAsset";
export * from "./SpriteLoader";
```

- [ ] **Step 7: Register the loader in `GameplayPlugin` and update the harness**

`packages/gameplay/src/GameplayPlugin.ts`:
- Add imports:

```ts
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";
import { SpriteLoader } from "./assets";
```

- Add `ASSET_MANAGER` to `requires`:

```ts
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE, ASSET_MANAGER],
      provides: [SCRIPT_MANAGER],
    });
```

- Inside `install`, after the other `await engine.services.wait(...)` calls, resolve the manager and register the loader:

```ts
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);
    assets.register(new SpriteLoader());
```

`packages/gameplay/test/helpers/harness.ts`:
- Add import: `import { AssetPlugin } from "@atlasjs/assets";`
- Register it before `GameplayPlugin` so the new dependency resolves:

```ts
  engine.use(new NexusPlugin());
  engine.use(new Provide("stub-nebula", NEBULA_RENDERER, fakeNebula));
  engine.use(new InertialPlugin(physics));
  engine.use(new AssetPlugin());
  engine.use(new GameplayPlugin());
```

- [ ] **Step 8: Run the full gameplay suite, typecheck, build**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS — all suites, including `sprite-asset.test.ts` (now `destroy`) and `sprite-asset-loader.test.ts`.

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit -p tsconfig.test.json`
Expected: no output (exit 0).

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: `dist` regenerated (exports `SpriteAsset`/`SpriteLoader`).

- [ ] **Step 9: Hand off** — do not commit; hand the diff to the user for review.

---

### Task 6: `apps/sandbox` — migrate off the manual loader

**Files:**
- Modify: `apps/sandbox/package.json` (add `@atlasjs/assets` dependency)
- Modify: `apps/sandbox/src/App.tsx`, `apps/sandbox/src/game/EcsScene.ts`

**Interfaces:**
- Consumes: `AssetPlugin`, `ASSET_MANAGER`, `AssetManager` from `@atlasjs/assets`; `TextureAsset` from `@atlasjs/nebula`; `SpriteAsset`, `Sprite` from `@atlasjs/gameplay`.
- Produces: nothing (app leaf).

- [ ] **Step 1: Add the assets dependency**

`apps/sandbox/package.json` — add `"@atlasjs/assets": "workspace:*"` to `dependencies`, then run `pnpm install`.
Expected: workspace link created, no errors.

- [ ] **Step 2: Register `AssetPlugin` in the engine boot**

`apps/sandbox/src/App.tsx`:
- Add import: `import { AssetPlugin } from "@atlasjs/assets";`
- Construct and register it (order is irrelevant — boot is topological — but the renderer/gameplay plugins now require it):

```ts
    const assetPlugin: AssetPlugin = new AssetPlugin();
```

```ts
    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);
```

- [ ] **Step 3: Migrate `EcsScene` onto the manager**

`apps/sandbox/src/game/EcsScene.ts`:
- Add import: `import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";`
- Replace the nebula import block with (drops `NebulaRenderer`/`NEBULA_RENDERER`, adds `TextureAsset`):

```ts
import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";
```

- Add `SpriteAsset` to the `@atlasjs/gameplay` import block (keep the rest):

```ts
import {
  type ScriptManager,
  button,
  defineActions,
  Key,
  SCRIPT_MANAGER,
  Sprite,
  SpriteAsset,
  vector2,
} from "@atlasjs/gameplay";
```

- Rewrite the top of `onCreate` (replace the `nebula`/`loadTexture` lines) and delete the `loadTexture` method entirely:

```ts
  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const blueDinoTexture: Texture2D = await assets.load<Texture2D>(
      new TextureAsset(BlueDino),
    );
    const blueDinoSprite: Sprite = await assets.load<Sprite>(
      new SpriteAsset(new TextureAsset(BlueDino)),
    );
    const sealionSprite: Sprite = await assets.load<Sprite>(
      new SpriteAsset(new TextureAsset(Sealion)),
    );

    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
    });
```

The remainder of `onCreate` (the `controls`, `clips`, entity creation, and `scriptManager.attach(...)` calls) is unchanged. Remove the entire `private async loadTexture(...)` method at the bottom of the file.

- [ ] **Step 4: Rebuild dependency dist and typecheck the app**

Run: `pnpm --filter @atlasjs/assets build && pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/gameplay build`
Expected: all three `dist` up to date.

Run: `pnpm --filter sandbox exec tsc --noEmit` (typecheck only — do not use the app's own `tsc -b` build step here, which emits artifacts).
Expected: no output (exit 0).

- [ ] **Step 5: Verify in the browser preview**

Start the sandbox dev server via the preview tool (do NOT use a raw shell server). Once up:
- Read console messages — expect **no** plugin-boot errors (no `MissingDependencyError` for `ASSET_MANAGER`, no `DuplicateProviderError`).
- Confirm the scene renders the dino + sealion sprites as before (screenshot). If the in-app browser lacks WebGPU, at minimum confirm the engine boots and the `AssetManager` resolves both loads without throwing (console clean).

- [ ] **Step 6: Hand off** — do not commit; hand the diff to the user for review.

---

### Task 7: Docs — mark the work done and cross-reference

**Files:**
- Modify: `docs/assets/asset-system.md` (tick the implementation checklist)
- Modify: `docs/backlog.md` (update the AssetManager item)
- Modify: `CLAUDE.md` (add a `docs/assets/` entry to the docs index)

**Interfaces:** none (documentation).

- [ ] **Step 1: Tick the spec checklist**

In `docs/assets/asset-system.md`, change the `## Checklist d'implémentation` boxes from `- [ ]` to `- [x]` for every item delivered by Tasks 1–6.

- [ ] **Step 2: Update the backlog**

In `docs/backlog.md`, under `## Sprites & Assets`, replace the `📋 **`AssetManager`**` bullet with an implemented entry pointing at the new doc, e.g.:

```markdown
- ✅ **Système d'assets** : _implémenté_ → [`assets/asset-system.md`](assets/asset-system.md) (`Asset`/`Resource` + `AssetManager` + loaders par type ; `TextureAsset`/`SpriteAsset`). Reste V2 : refcount/eviction (B1), `AssetRef` par id + sérialisation, audio, éditeur, sources non-path.
```

- [ ] **Step 3: Reference the new domain in the docs index**

In `CLAUDE.md`, add a `### docs/assets/` subsection (mirroring `### docs/gameplay/`) with a one-line entry for `docs/assets/asset-system.md` and its `-plan.md`.

- [ ] **Step 4: Hand off** — do not commit; hand the docs diff to the user for review.

---

## Self-Review

**Spec coverage** (against [`asset-system.md`](asset-system.md)): contracts `Asset`/`Resource`/`AssetLoader`/`LoadContext` → Task 2. `AssetManager` (register/load/get/destroy, dedup, composition, errors) → Task 2. `AssetPlugin` + `ASSET_MANAGER` → Task 3. `TextureAsset`/`TextureLoader` + `Texture2D → Resource` + `NebulaPlugin` wiring → Task 4. `SpriteAsset`/`SpriteLoader` + `Sprite → Resource` + `GameplayPlugin`/harness wiring → Task 5. Sandbox migration → Task 6. `*Node` rename (§7) → Task 1. Docs/backlog → Task 7. No gaps.

**Deferred (out of scope, per spec):** refcount/eviction/hot-reload, `AssetRef` by id + scene serialization, audio, editor, non-path sources — none of these appear as tasks, by design.

**Type consistency:** `Asset` = `{ type, id }` and `Resource` = `{ id, destroy() }` are used identically across Tasks 2–6. `AssetManager.load<R extends Resource>(asset: Asset): Promise<R>` and `LoadContext.load` share one signature; the SpriteLoader test's fake `ctx` matches it. `Texture2D extends Resource` (Task 4) is what lets `TextureLoader`/`SpriteLoader` type `Texture2D` as the loaded `R`. `SpriteAsset.id` default (`sprite:${texture.id}:full:center`) is asserted verbatim in Task 5's test against `TextureAsset("dino.png").id === "texture:dino.png"` from Task 4.

**Ordering note:** the `dist` of `@atlasjs/assets` must be built before Task 4 typechecks (Texture2D imports `Resource`), and both `assets` + `nebula` dist before Task 5, and all three before Task 6 — each such rebuild is an explicit step.
