# Sorting Layers, Y-sorting & Sprite Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Named sorting layers with a per-layer Y-sort mode, plus authorable sprite pivots, so a player entity interleaves in front of / behind multi-tile occluders (trees, bushes) by the Y of their "feet".

**Architecture:** `@atlasjs/nebula` becomes a purely mechanical sorter — each `DrawCommand` carries `{ sortingLayer, sortPrimary, sortSecondary, kindOrder, batchKey }` and `RenderQueue.sort` compares them in that order. `@atlasjs/gameplay` owns a named `SortingLayers` registry (per-layer `manual`/`ySorted` mode) and *collapses* mode+value into those numeric fields on the scene node. Occluders are ordinary sprite entities with a feet pivot in a `ySorted` layer; flat ground stays batched tilemaps in a `manual` layer.

**Tech Stack:** TypeScript, pnpm workspaces + Turborepo, vitest, tsdown (build), Vite (sandbox preview), WebGPU backend (`@atlasjs/nebula-webgpu`).

## Global Constraints

- **Always type the code** — function params, variables, class fields — even trivial types (repo rule).
- **No comments** in code (repo rule).
- **No circular dependencies.** `nebula` stays backend-agnostic: never import a backend package, WGSL, or `@webgpu/types`.
- **nebula knows nothing about layer names or Y-sort semantics** — it only sorts the five numeric fields. All naming + mode logic lives in `gameplay`.
- **Rebuild nebula `dist` after any nebula public-API change** (`pnpm --filter @atlasjs/nebula build`) so `gameplay` typecheck and the sandbox Vite preview resolve the new shape.
- **gameplay typecheck:** `pnpm --filter @atlasjs/gameplay typecheck` (`tsc --noEmit`). **Never** `tsc -b`.
- **Sandbox/app + script files must `import type`** any type-only symbol — `tsc` passes but Vite breaks at runtime (black screen) otherwise.
- **Do not auto-commit.** End each task by staging (`git add`) and leaving the change for the user to review and commit. Re-run the task's tests against the committed state, not just the working diff.
- **Rétro-compat:** default `sortingLayer = "Default"` (registry index 0, `manual`) reproduces today's behavior exactly.

---

## File Structure

**New files**
- `packages/gameplay/src/rendering/SortingLayers.ts` — the named registry (`define`/`indexOf`/`modeOf`), sole owner of layer names + modes.
- `packages/gameplay/src/rendering/tokens.ts` — `SORTING_LAYERS` service token.
- `packages/gameplay/src/rendering/index.ts` — barrel for the folder.
- `packages/gameplay/test/sorting-layers.test.ts` — registry unit tests.
- `packages/gameplay/test/sorting-layers-integration.test.ts` — render-system collapse tests (manual vs ySorted).

**Modified — nebula (mechanical sort)**
- `packages/nebula/src/graphics/Node.ts` — replace `zIndex`/`setZIndex` with `sortingLayer`/`sortPrimary`/`sortSecondary` (+ setters).
- `packages/nebula/src/renderers/DrawCommand.ts` — replace `sortKey` with the four structured fields on all three variants.
- `packages/nebula/src/renderers/RenderQueue.ts` — comparator sort.
- `packages/nebula/src/renderers/NodeRendererBase.ts` — delete `computeSortKey` + its constants.
- `packages/nebula/src/renderers/{SpriteRenderer,ShapeRenderer,TileMapNodeRenderer}.ts` — build commands from the node's structured fields.
- Tests: `packages/nebula/test/{RenderQueue,NodeRendererBase,TileMapNodeRenderer}.test.ts`.

**Modified — nebula (pivot in animation)**
- `packages/nebula/src/animations/Frame.ts` — add `pivot: Vec2`.
- `packages/nebula/src/animations/SpriteSheet.ts` — uniform sheet pivot stamped onto frames.
- `packages/nebula/src/animations/animation-types.ts` — `pivot?: Vec2` on both grid options.
- Test: `packages/nebula/test/SpriteSheet.test.ts`.

**Modified — gameplay (semantics + wiring)**
- `packages/gameplay/src/components/{SpriteRender,TileMapRenderer}.ts` — add `sortingLayer: string`.
- `packages/gameplay/src/systems/{SpriteRenderSystem,TileMapRenderSystem}.ts` — inject `SortingLayers`, collapse mode+value.
- `packages/gameplay/src/systems/AnimatorSystem.ts` — forward `frame.pivot`.
- `packages/gameplay/src/assets/SpriteAsset.ts` — `fromPath(path, options?)`.
- `packages/gameplay/src/GameplayPlugin.ts` — create/provide the registry, inject into render systems.
- `packages/gameplay/src/index.ts` — export `./rendering`.
- Tests: `packages/gameplay/test/{sprite-render-system,tilemap-render-system,animator-system,sprite-asset}.test.ts`.

**Modified — apps**
- `apps/webgpu/src/index.ts` — `setZIndex` → `setSortPrimary` (direct nebula user).
- `apps/sandbox/src/game/ResourcesPath.ts` + `apps/sandbox/src/game/EcsScene.ts` — demo: define layers, player feet pivot, tree occluders.

---

## Task 1: `SortingLayers` registry (pure gameplay logic)

**Files:**
- Create: `packages/gameplay/src/rendering/SortingLayers.ts`
- Create: `packages/gameplay/src/rendering/tokens.ts`
- Create: `packages/gameplay/src/rendering/index.ts`
- Modify: `packages/gameplay/src/index.ts`
- Test: `packages/gameplay/test/sorting-layers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SortMode = "manual" | "ySorted"`
  - `class SortingLayers { constructor(); define(defs: ReadonlyArray<{ name: string; mode?: SortMode }>): this; indexOf(name: string): number; modeOf(index: number): SortMode; }`
  - `const SORTING_LAYERS: ServiceToken<SortingLayers>`

- [ ] **Step 1: Write the failing test**

Create `packages/gameplay/test/sorting-layers.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { SortingLayers } from "../src/rendering/SortingLayers";

describe("SortingLayers", () => {
  it("seeds 'Default' at index 0 with manual mode", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.indexOf("Default")).toBe(0);
    expect(layers.modeOf(0)).toBe("manual");
  });

  it("assigns increasing indices after Default in declaration order", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([
      { name: "Ground", mode: "manual" },
      { name: "Entities", mode: "ySorted" },
      { name: "Overhead", mode: "manual" },
    ]);
    expect(layers.indexOf("Ground")).toBe(1);
    expect(layers.indexOf("Entities")).toBe(2);
    expect(layers.indexOf("Overhead")).toBe(3);
  });

  it("exposes each layer's sort mode by index", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    expect(layers.modeOf(layers.indexOf("Entities"))).toBe("ySorted");
  });

  it("defaults a layer with no explicit mode to manual", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Foreground" }]);
    expect(layers.modeOf(layers.indexOf("Foreground"))).toBe("manual");
  });

  it("falls back to index 0 for an unknown layer name", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.indexOf("Nope")).toBe(0);
  });

  it("returns manual for an out-of-range index", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.modeOf(99)).toBe("manual");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- sorting-layers.test`
Expected: FAIL — cannot resolve `../src/rendering/SortingLayers`.

- [ ] **Step 3: Implement the registry**

Create `packages/gameplay/src/rendering/SortingLayers.ts`:

```ts
import { createLogger, Logger } from "@atlasjs/utils";

export type SortMode = "manual" | "ySorted";

interface LayerEntry {
  name: string;
  mode: SortMode;
}

export class SortingLayers {
  private readonly logger: Logger;
  private readonly layers: LayerEntry[];
  private readonly index: Map<string, number>;

  public constructor() {
    this.logger = createLogger(SortingLayers.name);
    this.layers = [{ name: "Default", mode: "manual" }];
    this.index = new Map<string, number>([["Default", 0]]);
  }

  public define(defs: ReadonlyArray<{ name: string; mode?: SortMode }>): this {
    for (const def of defs) {
      if (this.index.has(def.name)) {
        this.logger.warn(`Sorting layer '${def.name}' already defined; ignored.`);
        continue;
      }

      const entry: LayerEntry = { name: def.name, mode: def.mode ?? "manual" };
      this.index.set(def.name, this.layers.length);
      this.layers.push(entry);
    }

    return this;
  }

  public indexOf(name: string): number {
    const found: number | undefined = this.index.get(name);

    if (found === undefined) {
      this.logger.warn(`Unknown sorting layer '${name}'; using 'Default'.`);
      return 0;
    }

    return found;
  }

  public modeOf(index: number): SortMode {
    const entry: LayerEntry | undefined = this.layers[index];
    return entry ? entry.mode : "manual";
  }
}
```

Create `packages/gameplay/src/rendering/tokens.ts`:

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { SortingLayers } from "./SortingLayers";

export const SORTING_LAYERS: ServiceToken<SortingLayers> =
  ServiceRegistry.createToken("SORTING_LAYERS");
```

Create `packages/gameplay/src/rendering/index.ts`:

```ts
export * from "./SortingLayers";
export * from "./tokens";
```

- [ ] **Step 4: Export the folder from the package barrel**

In `packages/gameplay/src/index.ts`, add a line after the `./camera` export (line 6):

```ts
export * from "./rendering";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test -- sorting-layers.test`
Expected: PASS (6 tests).

- [ ] **Step 6: Typecheck and stage (do not commit)**

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: no errors.

```bash
git add packages/gameplay/src/rendering packages/gameplay/src/index.ts packages/gameplay/test/sorting-layers.test.ts
```

Leave staged for the user to review and commit.

---

## Task 2: nebula structured sort key (behavior-preserving refactor)

Replaces the packed radix `sortKey` with the four structured fields and a comparator. This task keeps rendering **identical** (everything is layer 0, `sortPrimary = sortingOrder`, `sortSecondary = 0`) — it only changes the *shape* of the sort. It is the heaviest task: it touches every producer and consumer of the old key at once, because there is no green intermediate state between "packed key" and "structured fields".

**Files:**
- Modify: `packages/nebula/src/graphics/Node.ts`
- Modify: `packages/nebula/src/renderers/DrawCommand.ts`
- Modify: `packages/nebula/src/renderers/RenderQueue.ts`
- Modify: `packages/nebula/src/renderers/NodeRendererBase.ts`
- Modify: `packages/nebula/src/renderers/SpriteRenderer.ts:78-88`
- Modify: `packages/nebula/src/renderers/ShapeRenderer.ts:77-89`
- Modify: `packages/nebula/src/renderers/TileMapNodeRenderer.ts:61-72`
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts:61`
- Modify: `packages/gameplay/src/systems/TileMapRenderSystem.ts:98`
- Modify: `apps/webgpu/src/index.ts:117,132,135,138`
- Test: `packages/nebula/test/RenderQueue.test.ts` (rewrite `cmd`, add coverage)
- Test: `packages/nebula/test/NodeRendererBase.test.ts` (drop `computeSortKey` tests)
- Test: `packages/nebula/test/TileMapNodeRenderer.test.ts` (`zIndex`→`sortPrimary`, `sortKey`→`sortPrimary`)
- Test: `packages/gameplay/test/sprite-render-system.test.ts:100` (`zIndex`→`sortPrimary`)
- Test: `packages/gameplay/test/tilemap-render-system.test.ts:63` (`zIndex`→`sortPrimary`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `Node`: `public sortingLayer: number` (default 0), `public sortPrimary: number` (default 0), `public sortSecondary: number` (default 0), `setSortingLayer(v): this`, `setSortPrimary(v): this`, `setSortSecondary(v): this`. `zIndex`/`setZIndex` **removed**.
  - `DrawCommand` variants each carry `readonly sortingLayer: number; readonly sortPrimary: number; readonly sortSecondary: number; readonly kindOrder: number; readonly batchKey: number` (no `sortKey`).
  - `RenderQueue.sort()` orders by `sortingLayer`, then `sortPrimary`, then `sortSecondary`, then `kindOrder`, then `batchKey`.

- [ ] **Step 1: Rewrite the RenderQueue test to the structured comparator (failing)**

Replace the whole body of `packages/nebula/test/RenderQueue.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { RenderQueue } from "../src/renderers/RenderQueue";
import { Batcher, KIND_ORDER } from "../src/renderers/NodeRenderer";
import { DrawCommand } from "../src/renderers/DrawCommand";

type Ev = string;

function recorder(tag: string, log: Ev[]): Batcher {
  return {
    begin: (c: DrawCommand): void => log.push(`${tag}.begin:${c.batchKey}`),
    add: (c: DrawCommand): void => log.push(`${tag}.add:${c.batchKey}`),
    draw: (): void => log.push(`${tag}.draw`),
  };
}

function cmd(kind: string, sortPrimary: number, batchKey: number): DrawCommand {
  return {
    kind,
    sortingLayer: 0,
    sortPrimary,
    sortSecondary: 0,
    kindOrder: (KIND_ORDER as Record<string, number>)[kind] ?? 0,
    batchKey,
  } as unknown as DrawCommand;
}

function full(
  kind: string,
  sortingLayer: number,
  sortPrimary: number,
  sortSecondary: number,
  batchKey: number,
): DrawCommand {
  return {
    kind,
    sortingLayer,
    sortPrimary,
    sortSecondary,
    kindOrder: (KIND_ORDER as Record<string, number>)[kind] ?? 0,
    batchKey,
  } as unknown as DrawCommand;
}

describe("RenderQueue registry dispatch", () => {
  it("groups contiguous same-kind/same-batchKey runs and dispatches by kind", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));
    q.register("shape", recorder("shape", log));

    q.submit(cmd("sprite", 1, 7));
    q.submit(cmd("sprite", 2, 7));
    q.submit(cmd("shape", 3, 0));
    q.submit(cmd("sprite", 4, 9));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:7",
      "sprite.add:7",
      "sprite.add:7",
      "sprite.draw",
      "shape.begin:0",
      "shape.add:0",
      "shape.draw",
      "sprite.begin:9",
      "sprite.add:9",
      "sprite.draw",
    ]);
  });

  it("skips commands of an unregistered kind without invoking a batcher and without hanging", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(cmd("unknown", 1, 0));
    q.submit(cmd("sprite", 2, 5));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual(["sprite.begin:5", "sprite.add:5", "sprite.draw"]);
  });

  it("orders by sortingLayer before the within-layer value", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(full("sprite", 1, 0, 0, 11));
    q.submit(full("sprite", 0, 999, 0, 22));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:22",
      "sprite.add:22",
      "sprite.draw",
      "sprite.begin:11",
      "sprite.add:11",
      "sprite.draw",
    ]);
  });

  it("breaks ties within a layer by sortSecondary", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(full("sprite", 0, 42, 5, 33));
    q.submit(full("sprite", 0, 42, 1, 44));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:44",
      "sprite.add:44",
      "sprite.draw",
      "sprite.begin:33",
      "sprite.add:33",
      "sprite.draw",
    ]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @atlasjs/nebula test -- RenderQueue.test`
Expected: FAIL — `RenderQueue.sort` still reads `a.sortKey` (the two new tests order wrong / current code compiles but new-field ordering is not applied).

- [ ] **Step 3: Replace `zIndex` with the three sort fields in `Node`**

In `packages/nebula/src/graphics/Node.ts`, change the field declaration (line 7) and constructor init (line 15), and the setter (lines 73-76):

```ts
export class Node extends Transformable {
  public visible: boolean;
  public sortingLayer: number;
  public sortPrimary: number;
  public sortSecondary: number;

  private readonly children: Node[];
  private parent: Node | null;

  public constructor() {
    super();

    this.sortingLayer = 0;
    this.sortPrimary = 0;
    this.sortSecondary = 0;
    this.visible = true;
    this.children = [];

    this.parent = null;
  }
```

Replace `setZIndex` (lines 73-76) with three setters:

```ts
  public setSortingLayer(sortingLayer: number): this {
    this.sortingLayer = sortingLayer;
    return this;
  }

  public setSortPrimary(sortPrimary: number): this {
    this.sortPrimary = sortPrimary;
    return this;
  }

  public setSortSecondary(sortSecondary: number): this {
    this.sortSecondary = sortSecondary;
    return this;
  }
```

- [ ] **Step 4: Replace `sortKey` with structured fields in `DrawCommand`**

Rewrite `packages/nebula/src/renderers/DrawCommand.ts`:

```ts
import { Mat4, Vec4 } from "@atlasjs/math";

import { RenderState } from "../core/core-types";
import { Texture2D, Sampler } from "../core/resources";

export type SpriteDrawCommand = {
  readonly kind: "sprite";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly model: Mat4;
  readonly uvRect: Vec4;
  readonly tint: Vec4;
};

export type ShapeDrawCommand = {
  readonly kind: "shape";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

export type TileMapDrawCommand = {
  readonly kind: "tilemap";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly tint: Vec4;
  readonly models: ReadonlyArray<Mat4>;
  readonly uvRects: ReadonlyArray<Vec4>;
  readonly count: number;
};

export type DrawCommand = SpriteDrawCommand | ShapeDrawCommand | TileMapDrawCommand;
```

- [ ] **Step 5: Replace the sort with the comparator in `RenderQueue`**

In `packages/nebula/src/renderers/RenderQueue.ts`, replace `sort()` (lines 22-26):

```ts
  public sort(): void {
    this.commands.sort(
      (a: DrawCommand, b: DrawCommand) =>
        a.sortingLayer - b.sortingLayer ||
        a.sortPrimary - b.sortPrimary ||
        a.sortSecondary - b.sortSecondary ||
        a.kindOrder - b.kindOrder ||
        a.batchKey - b.batchKey,
    );
  }
```

- [ ] **Step 6: Delete `computeSortKey` and its constants in `NodeRendererBase`**

In `packages/nebula/src/renderers/NodeRendererBase.ts`, delete the four constants (lines 4-7) and the entire `computeSortKey` method (lines 25-36). Keep the class, `RENDER_STATES`, the cache field, `createRenderData`, and `getOrCreateRenderData`. The file should start:

```ts
import { BlendMode, RenderState } from "../core";
import { Node } from "../graphics";

export abstract class NodeRendererBase<TNode extends Node, TData> {
  protected static readonly RENDER_STATES: Record<BlendMode, RenderState> = {
    opaque: { blend: "opaque", depthTest: false, cull: "none" },
    alpha: { blend: "alpha", depthTest: false, cull: "none" },
    additive: { blend: "additive", depthTest: false, cull: "none" },
    multiply: { blend: "multiply", depthTest: false, cull: "none" },
  };

  private readonly renderDataCache: WeakMap<TNode, TData>;

  public constructor() {
    this.renderDataCache = new WeakMap();
  }

  protected abstract createRenderData(): TData;

  protected getOrCreateRenderData(node: TNode): TData {
    const cached: TData | undefined = this.renderDataCache.get(node);

    if (cached) {
      return cached;
    }

    const data: TData = this.createRenderData();
    this.renderDataCache.set(node, data);

    return data;
  }
}
```

- [ ] **Step 7: Build the sprite command from the node fields**

In `packages/nebula/src/renderers/SpriteRenderer.ts`, replace the returned object in `buildCommand` (lines 78-88):

```ts
    return {
      kind: "sprite",
      sortingLayer: sprite.sortingLayer,
      sortPrimary: sprite.sortPrimary,
      sortSecondary: sprite.sortSecondary,
      kindOrder: KIND_ORDER.sprite,
      batchKey: batchId,
      renderState: NodeRendererBase.RENDER_STATES[sprite.blend],
      texture: sprite.texture,
      model: data.model,
      uvRect: data.uvRect,
      tint: sprite.tint,
      sampler,
    };
```

- [ ] **Step 8: Build the shape command from the node fields**

In `packages/nebula/src/renderers/ShapeRenderer.ts`, replace the returned object in `buildCommand` (lines 77-89):

```ts
    return {
      kind: "shape",
      sortingLayer: shape.sortingLayer,
      sortPrimary: shape.sortPrimary,
      sortSecondary: shape.sortSecondary,
      kindOrder: KIND_ORDER.shape,
      batchKey: BATCH_IDS[shape.blend],
      renderState: NodeRendererBase.RENDER_STATES[shape.blend],
      model: data.model,
      color: data.color,
      params: data.params,
    };
```

- [ ] **Step 9: Build the tilemap command from the node fields**

In `packages/nebula/src/renderers/TileMapNodeRenderer.ts`, replace the returned object in `collect` (lines 61-72):

```ts
    return {
      kind: "tilemap",
      sortingLayer: tilemap.sortingLayer,
      sortPrimary: tilemap.sortPrimary,
      sortSecondary: tilemap.sortSecondary,
      kindOrder: KIND_ORDER.tilemap,
      batchKey: batchId,
      renderState: NodeRendererBase.RENDER_STATES[tilemap.blend],
      texture: tilemap.texture,
      sampler,
      tint: tilemap.tint,
      models: data.models,
      uvRects: data.uvRects,
      count: tilemap.instances.length,
    };
```

- [ ] **Step 10: Point the gameplay render systems at `sortPrimary` (behavior-preserving)**

In `packages/gameplay/src/systems/SpriteRenderSystem.ts`, change line 61 from `.setZIndex(spriteRender.sortingOrder);` to:

```ts
        .setSortPrimary(spriteRender.sortingOrder);
```

In `packages/gameplay/src/systems/TileMapRenderSystem.ts`, change line 98 from `node.zIndex = renderer.sortingOrder;` to:

```ts
    node.sortPrimary = renderer.sortingOrder;
```

- [ ] **Step 11: Update the direct-nebula app (`apps/webgpu`)**

In `apps/webgpu/src/index.ts`, replace `.setZIndex(...)` with `.setSortPrimary(...)` on all four sites (lines 117, 132, 135, 138):

```ts
  swordSprite.setScale(0.7, 0.7).setSortPrimary(-1);
```
```ts
  bgRect.setColor(0.15, 0.2, 0.55, 1).setPosition(200, 200).setSortPrimary(-1);
```
```ts
  circle.setColor(0.9, 0.3, 0.3, 1).setPosition(330, 130).setSortPrimary(1);
```
```ts
  line.setColor(0.2, 0.9, 0.4, 1).setSortPrimary(2);
```

- [ ] **Step 12: Rewrite `NodeRendererBase.test.ts` (drop the removed `computeSortKey`)**

Replace the whole file `packages/nebula/test/NodeRendererBase.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { Node } from "../src/graphics";
import { NodeRendererBase } from "../src/renderers/NodeRendererBase";

type Data = { value: number };

class Probe extends NodeRendererBase<Node, Data> {
  public created: number = 0;

  protected createRenderData(): Data {
    this.created++;
    return { value: this.created };
  }

  public data(node: Node): Data {
    return this.getOrCreateRenderData(node);
  }
}

describe("NodeRendererBase", () => {
  it("caches render data per node instance", () => {
    const p: Probe = new Probe();
    const a: Node = new Node();
    const b: Node = new Node();
    const da: Data = p.data(a);
    expect(p.data(a)).toBe(da);
    expect(p.data(b)).not.toBe(da);
    expect(p.created).toBe(2);
  });
});
```

- [ ] **Step 13: Update `TileMapNodeRenderer.test.ts`**

In `packages/nebula/test/TileMapNodeRenderer.test.ts`:
- Line 61: `low.zIndex = 0;` → `low.sortPrimary = 0;`
- Line 68: `high.zIndex = 5;` → `high.sortPrimary = 5;`
- Line 75: `expect(highCmd.sortKey).toBeGreaterThan(lowCmd.sortKey);` → `expect(highCmd.sortPrimary).toBeGreaterThan(lowCmd.sortPrimary);`
- Lines 92-103: replace the mock command's `sortKey: 0,` line with the structured fields:

```ts
    const command: TileMapDrawCommand = {
      kind: "tilemap",
      sortingLayer: 0,
      sortPrimary: 0,
      sortSecondary: 0,
      kindOrder: 2,
      batchKey: 0,
      renderState: { blend: "alpha", depthTest: false, cull: "none" },
      texture: fakeTexture(),
      sampler: { id: "smp" } as Sampler,
      tint: new Vec4(1, 1, 1, 1),
      models: [],
      uvRects: [],
      count: 3,
    } as unknown as TileMapDrawCommand;
```

- [ ] **Step 14: Update the two gameplay system tests**

In `packages/gameplay/test/sprite-render-system.test.ts`, line 100: `expect(node.zIndex).toBe(4);` → `expect(node.sortPrimary).toBe(4);`

In `packages/gameplay/test/tilemap-render-system.test.ts`, line 63: `expect(node.zIndex).toBe(7);` → `expect(node.sortPrimary).toBe(7);`

- [ ] **Step 15: Run nebula tests to green**

Run: `pnpm --filter @atlasjs/nebula test`
Expected: PASS (all nebula suites, including the 4 RenderQueue cases and the updated TileMapNodeRenderer cases).

- [ ] **Step 16: Rebuild nebula dist so downstream resolves the new shape**

Run: `pnpm --filter @atlasjs/nebula build`
Expected: build succeeds (this is also the nebula typecheck).

- [ ] **Step 17: Run gameplay tests + typecheck to green**

Run: `pnpm --filter @atlasjs/gameplay test`
Then: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS / no errors (rendering behavior unchanged — sorting order is identical for single-layer content).

- [ ] **Step 18: Stage (do not commit)**

```bash
git add packages/nebula apps/webgpu/src/index.ts packages/gameplay/src/systems/SpriteRenderSystem.ts packages/gameplay/src/systems/TileMapRenderSystem.ts packages/gameplay/test/sprite-render-system.test.ts packages/gameplay/test/tilemap-render-system.test.ts
```

Leave staged for review.

---

## Task 3: wire `SortingLayers` into the render path (semantics)

Adds `sortingLayer` to the two renderer components, injects the registry into both render systems, and provides it as a service.

**Files:**
- Modify: `packages/gameplay/src/components/SpriteRender.ts`
- Modify: `packages/gameplay/src/components/TileMapRenderer.ts`
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts`
- Modify: `packages/gameplay/src/systems/TileMapRenderSystem.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Modify: `packages/gameplay/test/sprite-render-system.test.ts` (setup passes a registry)
- Modify: `packages/gameplay/test/tilemap-render-system.test.ts` (setup passes a registry)
- Test: `packages/gameplay/test/sorting-layers-integration.test.ts` (new)

**Interfaces:**
- Consumes: `SortingLayers` + `SORTING_LAYERS` (Task 1); `Node.sortingLayer/sortPrimary/sortSecondary` (Task 2).
- Produces:
  - `SpriteRender.sortingLayer: string` (default `"Default"`); `TileMapRenderer.sortingLayer: string` (default `"Default"`).
  - `new SpriteRenderSystem(nebula: NebulaRenderer, sortingLayers: SortingLayers)`; `new TileMapRenderSystem(nebula: NebulaRenderer, sortingLayers: SortingLayers)`.
  - `GameplayPlugin` provides `SORTING_LAYERS`.

- [ ] **Step 1: Write the failing integration test**

Create `packages/gameplay/test/sorting-layers-integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Transform2D, Vec2 } from "@atlasjs/math";
import { NebulaRenderer, Sampler, SceneGraph, SpriteNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { Sprite } from "../src/assets";
import { SpriteRender, WorldTransform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";

function setup(layers: SortingLayers): {
  world: NexusWorld;
  scene: SceneGraph;
  system: SpriteRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(SpriteRender);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new SpriteRenderSystem(nebula, layers) };
}

function mount(
  world: NexusWorld,
  layer: string,
  order: number,
  transform: Transform2D,
): Entity {
  const entity: Entity = world.createEntity();
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  const render: SpriteRender = world.addComponent(
    entity,
    SpriteRender,
    new Sprite(fakeTexture()),
  );
  render.sortingLayer = layer;
  render.sortingOrder = order;
  return entity;
}

describe("SpriteRenderSystem sorting layers", () => {
  it("in a ySorted layer, sortPrimary is world Y and sortSecondary is sortingOrder", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    const { world, scene, system } = setup(layers);
    mount(world, "Entities", 3, new Transform2D(new Vec2(10, 42)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = scene.root.getChildren()[0] as SpriteNode;
    expect(node.sortingLayer).toBe(layers.indexOf("Entities"));
    expect(node.sortPrimary).toBeCloseTo(42, 4);
    expect(node.sortSecondary).toBe(3);
  });

  it("in a manual layer, sortPrimary is sortingOrder and sortSecondary is 0", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Ground", mode: "manual" }]);
    const { world, scene, system } = setup(layers);
    mount(world, "Ground", 7, new Transform2D(new Vec2(0, 99)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = scene.root.getChildren()[0] as SpriteNode;
    expect(node.sortingLayer).toBe(layers.indexOf("Ground"));
    expect(node.sortPrimary).toBe(7);
    expect(node.sortSecondary).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- sorting-layers-integration.test`
Expected: FAIL — `SpriteRenderSystem` constructor takes one argument; `SpriteRender.sortingLayer` does not exist.

- [ ] **Step 3: Add `sortingLayer` to `SpriteRender`**

Rewrite `packages/gameplay/src/components/SpriteRender.ts`:

```ts
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../assets";

export class SpriteRender {
  public sprite: Sprite;
  public color: Color;
  public flipX: boolean;
  public flipY: boolean;
  public visible: boolean;
  public sortingOrder: number;
  public sortingLayer: string;

  public constructor(
    sprite: Sprite,
    color: Color = Color.White(),
    flipX: boolean = false,
    flipY: boolean = false,
    visible: boolean = true,
    sortingOrder: number = 0,
    sortingLayer: string = "Default",
  ) {
    this.sprite = sprite;
    this.color = color;
    this.flipX = flipX;
    this.flipY = flipY;
    this.visible = visible;
    this.sortingOrder = sortingOrder;
    this.sortingLayer = sortingLayer;
  }
}
```

- [ ] **Step 4: Add `sortingLayer` to `TileMapRenderer`**

Rewrite `packages/gameplay/src/components/TileMapRenderer.ts`:

```ts
import { Color } from "@atlasjs/nebula";

export class TileMapRenderer {
  public sortingOrder: number;
  public color: Color;
  public visible: boolean;
  public sortingLayer: string;

  public constructor(
    sortingOrder: number = 0,
    color: Color = Color.White(),
    visible: boolean = true,
    sortingLayer: string = "Default",
  ) {
    this.sortingOrder = sortingOrder;
    this.color = color;
    this.visible = visible;
    this.sortingLayer = sortingLayer;
  }
}
```

- [ ] **Step 5: Inject the registry into `SpriteRenderSystem` and collapse mode+value**

In `packages/gameplay/src/systems/SpriteRenderSystem.ts`:

Add the type import near the top (with the other gameplay imports):

```ts
import type { SortingLayers } from "../rendering";
```

Add a field and constructor parameter:

```ts
  private readonly sortingLayers: SortingLayers;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<MountedSprite>();
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }
```

Replace the `node`-setting chain in `update` (lines 55-61) — end the chain at `setVisible`, then set the sort fields via the registry:

```ts
      node
        .setPosition(position.x, position.y)
        .setRotation(rotation)
        .setScale(scaleX, scaleY)
        .setTint(color.r, color.g, color.b, color.a)
        .setVisible(spriteRender.visible);

      const layerIndex: number = this.sortingLayers.indexOf(spriteRender.sortingLayer);
      node.sortingLayer = layerIndex;

      if (this.sortingLayers.modeOf(layerIndex) === "ySorted") {
        node.sortPrimary = position.y;
        node.sortSecondary = spriteRender.sortingOrder;
      } else {
        node.sortPrimary = spriteRender.sortingOrder;
        node.sortSecondary = 0;
      }
```

- [ ] **Step 6: Inject the registry into `TileMapRenderSystem` and collapse mode+value**

In `packages/gameplay/src/systems/TileMapRenderSystem.ts`:

Add the type import (with the other `import type` lines):

```ts
import type { SortingLayers } from "../rendering";
```

Add a field and constructor parameter:

```ts
  private readonly sortingLayers: SortingLayers;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.nodes = new Map<Entity, TileMapNode>();
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
  }
```

In `syncNode`, replace the single `node.sortPrimary = renderer.sortingOrder;` line (from Task 2, was line 98) with the registry collapse (uses `position`, already computed at the top of `syncNode`):

```ts
    const layerIndex: number = this.sortingLayers.indexOf(renderer.sortingLayer);
    node.sortingLayer = layerIndex;

    if (this.sortingLayers.modeOf(layerIndex) === "ySorted") {
      node.sortPrimary = position.y;
      node.sortSecondary = renderer.sortingOrder;
    } else {
      node.sortPrimary = renderer.sortingOrder;
      node.sortSecondary = 0;
    }
```

- [ ] **Step 7: Create, inject and provide the registry in `GameplayPlugin`**

In `packages/gameplay/src/GameplayPlugin.ts`:

Add to the imports (near `SortingLayers` is exported from the package root; import from the rendering folder to avoid a self-cycle):

```ts
import { SortingLayers, SORTING_LAYERS } from "./rendering";
```

Add `SORTING_LAYERS` to the `provides` array in the constructor (line 50):

```ts
      provides: [SCRIPT_MANAGER, CAMERA_MANAGER, SORTING_LAYERS],
```

In `install`, create the registry before the systems and pass it to both render systems (replace lines 71-72):

```ts
    const sortingLayers: SortingLayers = new SortingLayers();
    const spriteRenderSystem: SpriteRenderSystem = new SpriteRenderSystem(nebula, sortingLayers);
    const tileMapRenderSystem: TileMapRenderSystem = new TileMapRenderSystem(nebula, sortingLayers);
```

Provide it alongside the other services (after line 198):

```ts
    engine.services.provide(SORTING_LAYERS, sortingLayers);
```

- [ ] **Step 8: Update the two existing render-system test setups to pass a registry**

In `packages/gameplay/test/sprite-render-system.test.ts`:
- Add the import: `import { SortingLayers } from "../src/rendering";`
- Change the `setup()` return line (line 30) `system: new SpriteRenderSystem(nebula)` → `system: new SpriteRenderSystem(nebula, new SortingLayers())`.

In `packages/gameplay/test/tilemap-render-system.test.ts`:
- Add the import: `import { SortingLayers } from "../src/rendering";`
- Change the `setup()` return line (line 28) `system: new TileMapRenderSystem(nebula)` → `system: new TileMapRenderSystem(nebula, new SortingLayers())`.

(Their existing assertions still hold: default layer `"Default"` is `manual`, so `sortPrimary === sortingOrder`.)

- [ ] **Step 9: Run the integration test, then the full gameplay suite**

Run: `pnpm --filter @atlasjs/gameplay test -- sorting-layers-integration.test`
Expected: PASS (2 tests).

Run: `pnpm --filter @atlasjs/gameplay test`
Then: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS / no errors.

- [ ] **Step 10: Stage (do not commit)**

```bash
git add packages/gameplay/src/components/SpriteRender.ts packages/gameplay/src/components/TileMapRenderer.ts packages/gameplay/src/systems/SpriteRenderSystem.ts packages/gameplay/src/systems/TileMapRenderSystem.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/sprite-render-system.test.ts packages/gameplay/test/tilemap-render-system.test.ts packages/gameplay/test/sorting-layers-integration.test.ts
```

---

## Task 4: `SpriteAsset.fromPath(path, options?)`

**Files:**
- Modify: `packages/gameplay/src/assets/SpriteAsset.ts:38-41`
- Test: `packages/gameplay/test/sprite-asset.test.ts`

**Interfaces:**
- Produces: `SpriteAsset.fromPath(path: string, options?: SpriteAssetOptions): SpriteAsset`.

- [ ] **Step 1: Write the failing test**

Append to `packages/gameplay/test/sprite-asset.test.ts` (ensure `Bound` and `Vec2` are imported from `@atlasjs/math` at the top of the file; add them if missing):

```ts
describe("SpriteAsset.fromPath", () => {
  it("forwards rect and pivot into the asset", () => {
    const asset: SpriteAsset = SpriteAsset.fromPath("tree.png", {
      rect: new Bound(0, 0, 96, 160),
      pivot: new Vec2(0.5, 1),
    });

    expect(asset.rect?.width).toBe(96);
    expect(asset.rect?.height).toBe(160);
    expect(asset.pivot?.x).toBe(0.5);
    expect(asset.pivot?.y).toBe(1);
  });

  it("leaves rect and pivot undefined when no options are given", () => {
    const asset: SpriteAsset = SpriteAsset.fromPath("tree.png");

    expect(asset.rect).toBeUndefined();
    expect(asset.pivot).toBeUndefined();
  });
});
```

(`SpriteAsset` is already imported in this test file. If `Bound`/`Vec2` are not, add `import { Bound, Vec2 } from "@atlasjs/math";`.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- sprite-asset.test`
Expected: FAIL — `fromPath` expected 1 argument but got 2 (type error) / pivot undefined.

- [ ] **Step 3: Widen `fromPath`**

In `packages/gameplay/src/assets/SpriteAsset.ts`, replace `fromPath` (lines 38-41):

```ts
  public static fromPath(path: string, options?: SpriteAssetOptions): SpriteAsset {
    const texture: TextureAsset = new TextureAsset(path);
    return new SpriteAsset(texture, options);
  }
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `pnpm --filter @atlasjs/gameplay test -- sprite-asset.test`
Expected: PASS.

- [ ] **Step 5: Typecheck and stage**

Run: `pnpm --filter @atlasjs/gameplay typecheck`

```bash
git add packages/gameplay/src/assets/SpriteAsset.ts packages/gameplay/test/sprite-asset.test.ts
```

---

## Task 5: pivot preserved through animation

Adds a uniform pivot to `SpriteSheet`/`Frame` and forwards it through the `AnimatorSystem`, so an animated entity keeps its feet pivot instead of snapping to center.

**Files:**
- Modify: `packages/nebula/src/animations/Frame.ts`
- Modify: `packages/nebula/src/animations/animation-types.ts`
- Modify: `packages/nebula/src/animations/SpriteSheet.ts`
- Modify: `packages/gameplay/src/systems/AnimatorSystem.ts:35`
- Test: `packages/nebula/test/SpriteSheet.test.ts`
- Test: `packages/gameplay/test/animator-system.test.ts`

**Interfaces:**
- Produces:
  - `new Frame(texture, rect, pivot?: Vec2)`; `Frame.pivot: Vec2` (default `(0.5, 0.5)`).
  - `new SpriteSheet(texture, pivot?: Vec2)`; `define` stamps `pivot` onto every frame.
  - `FromGridOptions.pivot?: Vec2`, `FromAutoGridOptions.pivot?: Vec2`.

- [ ] **Step 1: Write the failing nebula test**

Append to `packages/nebula/test/SpriteSheet.test.ts` (the file already has a local `fakeTexture(width, height)` and imports `Frame`/`SpriteSheet`; add `import { Vec2 } from "@atlasjs/math";` at the top):

```ts
describe("SpriteSheet pivot", () => {
  it("stamps the sheet pivot onto every defined frame", () => {
    const sheet: SpriteSheet = new SpriteSheet(fakeTexture(64, 64), new Vec2(0.5, 1));
    sheet.define("a", 0, 0, 16, 16);
    expect(sheet.get("a").pivot.x).toBe(0.5);
    expect(sheet.get("a").pivot.y).toBe(1);
  });

  it("propagates the pivot through fromAutoGrid", () => {
    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "f",
      texture: fakeTexture(64, 64),
      rows: 1,
      columns: 2,
      pivot: new Vec2(0.5, 1),
    });
    expect(sheet.get("f_0").pivot.y).toBe(1);
  });

  it("defaults a frame pivot to center when unspecified", () => {
    const sheet: SpriteSheet = new SpriteSheet(fakeTexture(64, 64));
    sheet.define("a", 0, 0, 16, 16);
    expect(sheet.get("a").pivot.x).toBe(0.5);
    expect(sheet.get("a").pivot.y).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @atlasjs/nebula test -- SpriteSheet.test`
Expected: FAIL — `Frame.pivot` does not exist; `SpriteSheet` constructor / `fromAutoGrid` reject `pivot`.

- [ ] **Step 3: Add `pivot` to `Frame`**

Rewrite `packages/nebula/src/animations/Frame.ts`:

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import { Texture2D } from "../core";

export class Frame {
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  public constructor(texture: Texture2D, rect: Bound, pivot: Vec2 = new Vec2(0.5, 0.5)) {
    this.texture = texture;
    this.rect = rect;
    this.pivot = pivot;
  }

  public clone(): Frame {
    return new Frame(this.texture, this.rect.clone(), this.pivot.clone());
  }
}
```

- [ ] **Step 4: Add `pivot?` to the grid option types**

In `packages/nebula/src/animations/animation-types.ts`, add the `Vec2` import and a `pivot?` field to both grid option types:

```ts
import { Vec2 } from "@atlasjs/math";
import { Texture2D } from "../core";
import { Frame } from "./Frame";

export type FromGridOptions = {
  name: string;
  texture: Texture2D;
  frameWidth: number;
  frameHeight: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
};

export type FromAutoGridOptions = {
  name: string;
  texture: Texture2D;
  rows: number;
  columns: number;
  pivot?: Vec2;
};

export type SpriteAnimationOptions = {
  frames: Frame[];
  fps: number;
  loop?: boolean;
  autoPlay?: boolean;
};
```

- [ ] **Step 5: Store a sheet pivot and stamp it onto frames**

In `packages/nebula/src/animations/SpriteSheet.ts`, add the `Vec2` import, a `pivot` field, and thread it through `define`, `fromAutoGrid`, `fromGrid`:

```ts
import { Bound, Vec2 } from "@atlasjs/math";

import { Frame } from "./Frame";
import { Texture2D } from "../core";
import { FromAutoGridOptions, FromGridOptions } from "./animation-types";

export class SpriteSheet {
  private readonly texture: Texture2D;
  private readonly pivot: Vec2;
  private readonly frames: Map<string, Frame>;

  public constructor(texture: Texture2D, pivot: Vec2 = new Vec2(0.5, 0.5)) {
    this.texture = texture;
    this.pivot = pivot;
    this.frames = new Map();
  }
```

Change `define` to stamp the pivot (replace lines 20-31):

```ts
  public define(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): this {
    const bound: Bound = new Bound(x, y, width, height);
    const frame: Frame = new Frame(this.texture, bound, this.pivot.clone());
    this.frames.set(name, frame);
    return this;
  }
```

Change `fromAutoGrid` to accept + pass the pivot (replace its signature + first line, lines 60-66):

```ts
  public static fromAutoGrid({
    name,
    texture,
    rows,
    columns,
    pivot,
  }: FromAutoGridOptions): SpriteSheet {
    const spriteSheet: SpriteSheet = new SpriteSheet(texture, pivot);
    const frameWidth: number = texture.width / columns;
    const frameHeight: number = texture.height / rows;
```

Change `fromGrid` likewise (replace its signature + first line, lines 83-91):

```ts
  public static fromGrid({
    name,
    texture,
    frameHeight,
    frameWidth,
    spacing = 0,
    margin = 0,
    pivot,
  }: FromGridOptions): SpriteSheet {
    const spriteSheet: SpriteSheet = new SpriteSheet(texture, pivot);
    let id: number = 0;
```

(Passing `pivot: undefined` to the constructor is safe — the `= new Vec2(0.5, 0.5)` default applies.)

- [ ] **Step 6: Run the nebula test to green + rebuild dist**

Run: `pnpm --filter @atlasjs/nebula test -- SpriteSheet.test`
Expected: PASS.

Run: `pnpm --filter @atlasjs/nebula build`
Expected: build succeeds (updates dist for the gameplay test in the next step).

- [ ] **Step 7: Write the failing animator test**

Append to `packages/gameplay/test/animator-system.test.ts` (add `Vec2` to the `@atlasjs/math` import at the top — it currently imports only `Bound`):

```ts
it("forwards the frame pivot into the swapped Sprite", async () => {
  const harness: Harness = await createHarness();
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = [
    new Frame(texture, new Bound(0, 0, 16, 32), new Vec2(0.5, 1)),
  ];
  const clip: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop: true,
    autoPlay: true,
  });

  const entity: Entity = harness.world.createEntity();
  harness.world.addComponent(entity, Transform2D);
  harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
  harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

  harness.frame();

  const spriteRender = harness.world.getComponent(entity, SpriteRender) as SpriteRender;
  expect(spriteRender.sprite.pivot.x).toBe(0.5);
  expect(spriteRender.sprite.pivot.y).toBe(1);
});
```

- [ ] **Step 8: Run it to confirm it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- animator-system.test`
Expected: FAIL — the swapped sprite pivot is `(0.5, 0.5)` because `AnimatorSystem.spriteFor` drops the frame pivot.

- [ ] **Step 9: Forward the frame pivot in `AnimatorSystem`**

In `packages/gameplay/src/systems/AnimatorSystem.ts`, change line 35:

```ts
      sprite = new Sprite(frame.texture, { rect: frame.rect, pivot: frame.pivot });
```

- [ ] **Step 10: Run it to green + full suites**

Run: `pnpm --filter @atlasjs/gameplay test -- animator-system.test`
Expected: PASS.

Run: `pnpm --filter @atlasjs/gameplay test`
Then: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS / no errors.

- [ ] **Step 11: Stage (do not commit)**

```bash
git add packages/nebula/src/animations packages/nebula/test/SpriteSheet.test.ts packages/gameplay/src/systems/AnimatorSystem.ts packages/gameplay/test/animator-system.test.ts
```

---

## Task 6: sandbox demo + browser verification

Wire the feature end-to-end in `apps/sandbox`: named layers, a feet-pivoted animated player in a `ySorted` layer, and tree occluders sliced from `plant.png`, then verify the occlusion flip in the browser. This task has no unit test — its gate is the mandatory browser verification.

**Files:**
- Modify: `apps/sandbox/src/game/ResourcesPath.ts`
- Modify: `apps/sandbox/src/game/EcsScene.ts`

**Interfaces:**
- Consumes everything from Tasks 1–5: `SORTING_LAYERS`/`SortingLayers`, `SpriteRender.sortingLayer`, `TileMapRenderer.sortingLayer`, `SpriteAsset.fromPath(path, options)`, `SpriteSheet.fromAutoGrid({ pivot })`.

- [ ] **Step 1: Add the `plant.png` asset path**

In `apps/sandbox/src/game/ResourcesPath.ts`, add the import (with the other `@assets` imports) and a `Player` group under `Tilesets`:

```ts
import Plant from "@assets/tilesets/player/plant.png";
```

Add to the `Tilesets` object:

```ts
    Player: {
      Plant: Plant,
    },
```

- [ ] **Step 2: Define the sorting layers at scene start**

In `apps/sandbox/src/game/EcsScene.ts`, add to the `@atlasjs/gameplay` import block:

```ts
  SORTING_LAYERS,
  SpriteRenderer,
```
(`SpriteRenderer` is already imported — only add `SORTING_LAYERS`. Also add `type SortingLayers` to the `type`-prefixed imports.) Add `Bound` and `Sprite`-adjacent imports as needed: ensure `Bound` is imported from `@atlasjs/math` (add `Bound` to the `@atlasjs/math` import — the file currently imports only `Vec2`).

At the top of `onCreate`, before `loadMap`, resolve and define the registry:

```ts
    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);
    sortingLayers.define([
      { name: "Ground", mode: "manual" },
      { name: "Entities", mode: "ySorted" },
      { name: "Overhead", mode: "manual" },
    ]);
```

- [ ] **Step 3: Put the ground/props tilemaps on the `"Ground"` layer**

In `loadMap`, set the layer on both `TileMapRenderer`s. Replace the two `nexus.addComponent(..., TileMapRenderer);` lines (lines 99 and 104):

```ts
    nexus.addComponent(ground, TileMapRenderer).sortingLayer = "Ground";
```
```ts
    nexus.addComponent(props, TileMapRenderer).sortingLayer = "Ground";
```

- [ ] **Step 4: Give the player a feet pivot and put it on `"Entities"`**

In `initializePlayer`, give both the initial sprite and the animation frames a feet pivot.

Change the initial dino sprite asset (line 135) to carry the pivot:

```ts
    const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, {
      pivot: new Vec2(0.5, 1),
    });
```

Change the sheet build (lines 142-147) to stamp the pivot on every frame:

```ts
    const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
      pivot: new Vec2(0.5, 1),
    });
```

Set the player's sorting layer (replace line 180):

```ts
    nexus.addComponent(player, SpriteRenderer, blueDinoSprite).sortingLayer = "Entities";
```

Put the shadow on `"Entities"` under the player (replace line 193) so it is not hidden beneath the `"Ground"` tilemap:

```ts
    const shadowRender = nexus.addComponent(shadow, SpriteRenderer, shadowSprite);
    shadowRender.sortingLayer = "Entities";
    shadowRender.sortingOrder = -1;
```

- [ ] **Step 5: Spawn two tree occluders from `plant.png`**

Still in `initializePlayer`, after the player is created, load a tree sprite and place two of them near the spawn. Add:

```ts
    const treeAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Tilesets.Player.Plant, {
      rect: new Bound(16, 8, 120, 150),
      pivot: new Vec2(0.5, 1),
    });
    const treeSprite: Sprite = await assets.load<Sprite>(treeAsset);

    for (let i: number = 0; i < 2; i++) {
      const tree: Entity = nexus.createEntity();
      const treeTransform: Transform2D = nexus.addComponent(tree, Transform2D);
      treeTransform.position = new Vec2(spawnPosition.x + 120 + i * 160, spawnPosition.y);
      nexus.addComponent(tree, SpriteRenderer, treeSprite).sortingLayer = "Entities";
    }
```

(The `rect` is a first guess into `plant.png`'s top-left tree — refine it by eye during verification. `Transform2D` has a no-arg constructor, so set `.position` after `addComponent`.)

- [ ] **Step 6: Typecheck the sandbox**

Run: `pnpm --filter @atlasjs/nebula build` then `pnpm --filter @atlasjs/gameplay build`
Then typecheck the sandbox (it consumes both dists): `pnpm --filter sandbox exec tsc --noEmit`
Expected: no errors. If a type-only symbol (e.g. `SortingLayers`) was imported as a value, switch it to `import type` (Vite runtime break otherwise).

- [ ] **Step 7: Launch the sandbox preview**

Use the preview tool to start the sandbox dev server (create `.claude/launch.json` with the sandbox's Vite dev command if it does not exist), then open it.

- [ ] **Step 8: Check for load errors**

Read the console + preview logs. Expected: no errors; specifically no "type-only import" runtime break (blank canvas) and no asset-404 for `plant.png`.

- [ ] **Step 9: Verify the occlusion flip**

Move the player above a tree (north / smaller world Y) and screenshot: the player is drawn **behind** the tree (foliage covers it). Move the player below the tree (south / larger world Y) and screenshot: the player is drawn **in front**. The flip must happen at the tree's feet line. Confirm the player stays feet-pivoted through its walk animation (no vertical "jump" when it starts moving). Adjust the tree `rect` if the crop includes neighbouring sprites.

- [ ] **Step 10: Stage (do not commit)**

```bash
git add apps/sandbox/src/game/ResourcesPath.ts apps/sandbox/src/game/EcsScene.ts
```

Report the before/after screenshots to the user.

---

## Backlog reconciliation (after all tasks land)

Update `docs/backlog.md`: under **Gameplay — TileSet & TileMap**, mark *"Sorting layers nommés + order-in-layer"* as implemented and point to `docs/rendering/sorting-layers.md`; under **Animation — suites V2**, mark the *"Pivot par frame"* item as resolved for the uniform-per-sheet case (distinct-per-frame pivots remain backlog). Leave this as staged edits for the user.

## Self-Review

- **Spec coverage:** §4 (nebula mechanical sort) → Task 2. §5.1 (registry) → Task 1. §5.2 (component fields) → Task 3. §5.3 (collapse) → Task 3. §5.4 (data flow) → verified by Task 3 integration test + Task 6 browser check. §6.1 (`fromPath`) → Task 4. §6.2 (`Frame.pivot`/animator) → Task 5. §7 (occluder authoring) → Task 6. §9 (tests) → per-task tests + Task 6 browser verify. Precedence + tiebreak (§3 #4/#5) → Task 2 RenderQueue tests + Task 3 integration test.
- **Placeholder scan:** none — every code step shows full code; the one visual unknown (`plant.png` tree rect) is an explicit first-guess with a refine-in-browser instruction, appropriate for a visual demo task.
- **Type consistency:** `SortMode`, `SortingLayers.{define,indexOf,modeOf}`, `SORTING_LAYERS`, `Node.{sortingLayer,sortPrimary,sortSecondary}`, the five `DrawCommand` fields, `Frame.pivot`, `SpriteSheet(texture, pivot)`, and both render-system constructor signatures are used identically across Tasks 1–6.
