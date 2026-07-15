# Renderer refactor E3 — NodeRenderer seam + renderer dedup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the node→draw dispatch that is currently hardcoded at 6 sites (and duplicated across `SpriteRenderer`/`ShapeRenderer`) behind a single `NodeRenderer` seam + a `Map<kind, Batcher>` registry in `RenderQueue` + a shared `NodeRendererBase`, so a new kind (text, particles) plugs in without touching the dispatch machinery.

**Architecture:** Three sequenced phases, each independently shippable and verifiable. (1) Extract the pure world-AABB-from-model computation into one tested helper and route `ShapeRenderer` through it. (2) Introduce the `NodeRenderer` interface + `NodeRendererBase` (shared `RENDER_STATES`, z-packing constants, `computeSortKey`, `getOrCreateRenderData`) and refactor both renderers onto them. (3) Introduce the `Batcher` interface + `RenderQueue` registry and make `SceneRenderer.collect` fully generic (iterate registered `NodeRenderer`s, build→bound→cull→submit uniformly). `DrawCommand` stays a concrete tagged union — the seam is on the *dispatch*, not the data.

**Tech Stack:** TypeScript, `@atlasjs/math` (`Mat4`/`Vec2`/`Vec4`/`Bound`), vitest, tsdown, pnpm/turbo monorepo. This is `@atlasjs/nebula` (backend-agnostic core) — pure logic, fully unit-testable under Node.

## Global Constraints

- **Backend-agnostic core.** No `@webgpu/types`, no WGSL, no backend import anywhere under `packages/nebula`. (CLAUDE.md invariant.)
- **Type everything** (params, variables, class fields), even trivially. **No comments** in code.
- **Behavior-preserving.** The set of submitted `DrawCommand`s, their sort order, run-batching, and the rendered frame must be identical to before. The one intentional, output-preserving change: sprites move from cull-then-build to build-then-cull (shapes already build-then-cull), culling on the command-model AABB — proven equivalent to `Sprite.getWorldBound()` (unit-quad transform of the command model = world rect).
- **Keep `DrawCommand` concrete** (the tagged union in `DrawCommand.ts`). Batchers need the typed fields; the seam abstracts dispatch, not the command data.
- **No auto-commit.** Leave changes in the working tree; the user commits. Commit *checkpoints* below are suggested boundaries, not automated.
- Findings spec: `docs/renderer-backlog.md` §E3. Out of scope: D5 (sort-key stability at equal z) and D6 (`MaterialShaderBuilder`) — do not touch them.

---

## File Structure

- **Create** `packages/nebula/src/renderers/worldBound.ts` — pure `computeModelWorldBound(model, out)` (the AABB-from-model computation, extracted from `ShapeRenderer.getWorldBound`).
- **Create** `packages/nebula/src/renderers/NodeRenderer.ts` — the `NodeRenderer` seam interface + the `Batcher` interface.
- **Create** `packages/nebula/src/renderers/NodeRendererBase.ts` — abstract base: shared `RENDER_STATES`, z-packing constants, `computeSortKey`, `getOrCreateRenderData`.
- **Modify** `packages/nebula/src/renderers/ShapeRenderer.ts` — extend the base, implement `NodeRenderer` (`kind`/`matches`/`createBatcher`), drop its own `RENDER_STATES`/z-constants/`computeSortKey`/`getOrCreateRenderData`, route bound through the helper.
- **Modify** `packages/nebula/src/renderers/SpriteRenderer.ts` — same: extend base, implement `NodeRenderer`.
- **Modify** `packages/nebula/src/renderers/Batchers.ts` — `SpriteBatcher`/`ShapeBatcher` implement `Batcher`.
- **Modify** `packages/nebula/src/renderers/RenderQueue.ts` — `Map<string, Batcher>` registry; `register(kind, batcher)`; generic `flush(renderer)`.
- **Modify** `packages/nebula/src/renderers/SceneRenderer.ts` — `nodeRenderers` list, register batchers, generic `collect` (build→bound→cull→submit).
- **Modify** `packages/nebula/src/renderers/index.ts` — export the new modules.
- **Test** `packages/nebula/test/{worldBound,RenderQueue,NodeRendererBase}.test.ts`.

**Runtime verification (Phase 3):** `apps/webgpu` via the preview tools — render, screenshot, confirm the console/network are clean and the frame is visually identical (sprite + rect + circle + line) to before.

---

## Phase 1 — Task 1: pure `computeModelWorldBound` helper

**Why first:** it is pure, isolated, and gives Phase 3's uniform culling its foundation. Extracting it now (and routing `ShapeRenderer` through it) gives it an immediate consumer and a locked-in test.

**Files:**
- Create: `packages/nebula/src/renderers/worldBound.ts`
- Modify: `packages/nebula/src/renderers/ShapeRenderer.ts` (route `getWorldBound` through the helper)
- Modify: `packages/nebula/src/renderers/index.ts`
- Test: `packages/nebula/test/worldBound.test.ts`

**Interfaces:**
- Produces: `computeModelWorldBound(model: Mat4, out: Bound): Bound` — transforms the unit quad corners `[-0.5, 0.5]²` by `model` and writes the world-space AABB (`x, y, width, height`) into `out`, returning it.

- [ ] **Step 1: Write the failing test** — `packages/nebula/test/worldBound.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Mat4, Bound } from "@atlasjs/math";

import { computeModelWorldBound } from "../src/renderers/worldBound";

describe("computeModelWorldBound", () => {
  it("maps the identity model to the unit quad AABB", () => {
    const out: Bound = new Bound();
    computeModelWorldBound(Mat4.identity(), out);
    expect(out.x).toBeCloseTo(-0.5);
    expect(out.y).toBeCloseTo(-0.5);
    expect(out.width).toBeCloseTo(1);
    expect(out.height).toBeCloseTo(1);
  });

  it("applies scale and translation", () => {
    const out: Bound = new Bound();
    const model: Mat4 = Mat4.identity().translate(10, 20, 0).scale(4, 2);
    computeModelWorldBound(model, out);
    expect(out.x).toBeCloseTo(8);
    expect(out.y).toBeCloseTo(19);
    expect(out.width).toBeCloseTo(4);
    expect(out.height).toBeCloseTo(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/worldBound.test.ts`
Expected: FAIL — cannot resolve `computeModelWorldBound`.

- [ ] **Step 3: Create the helper** — `packages/nebula/src/renderers/worldBound.ts` (the exact math currently in `ShapeRenderer.getWorldBound`, generalized to take a `Mat4`):

```ts
import { Bound, Mat4 } from "@atlasjs/math";

const CORNERS: ReadonlyArray<number> = [
  -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
];

export function computeModelWorldBound(model: Mat4, out: Bound): Bound {
  const m: Float32Array = model.buffer;
  const m0: number = m[0];
  const m1: number = m[1];
  const m4: number = m[4];
  const m5: number = m[5];
  const m12: number = m[12];
  const m13: number = m[13];

  let minX: number = Infinity;
  let minY: number = Infinity;
  let maxX: number = -Infinity;
  let maxY: number = -Infinity;

  for (let i: number = 0; i < CORNERS.length; i += 2) {
    const cx: number = CORNERS[i];
    const cy: number = CORNERS[i + 1];
    const px: number = m0 * cx + m4 * cy + m12;
    const py: number = m1 * cx + m5 * cy + m13;

    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return out.set(minX, minY, maxX - minX, maxY - minY);
}
```

- [ ] **Step 4: Route `ShapeRenderer.getWorldBound` through the helper.** In `ShapeRenderer.ts`, replace the body of `getWorldBound(command, out)` so it delegates (keep the public method for now — Phase 3 removes it):

```ts
  public getWorldBound(command: ShapeDrawCommand, out: Bound): Bound {
    return computeModelWorldBound(command.model, out);
  }
```

Add the import `import { computeModelWorldBound } from "./worldBound";` and remove the now-unused `corners`/loop locals. Leave `ShapeRenderer`'s other logic untouched.

- [ ] **Step 5: Export from the barrel.** In `packages/nebula/src/renderers/index.ts` add:

```ts
export * from "./worldBound";
```

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/worldBound.test.ts` → PASS.
Run: `pnpm --filter @atlasjs/nebula build` → PASS, d.ts emitted.

- [ ] **Step 7: Commit checkpoint** (suggested): `refactor(nebula): extract computeModelWorldBound helper (E3)`.

---

## Phase 2 — Task 2: `NodeRenderer` seam + `NodeRendererBase` + renderer refactor

**Why:** this removes the `SpriteRenderer`/`ShapeRenderer` duplication (byte-identical `RENDER_STATES`, z-packing constants, `computeSortKey`, `getOrCreateRenderData` WeakMap) into a shared base, and gives both renderers the `NodeRenderer` shape (`kind`, `matches`, `createBatcher`) that Phase 3's generic dispatch consumes. Additive — no dispatch site changes yet, so the build/scene keep working.

**Files:**
- Create: `packages/nebula/src/renderers/NodeRenderer.ts`
- Create: `packages/nebula/src/renderers/NodeRendererBase.ts`
- Modify: `packages/nebula/src/renderers/SpriteRenderer.ts`, `ShapeRenderer.ts`
- Modify: `packages/nebula/src/renderers/index.ts`
- Test: `packages/nebula/test/NodeRendererBase.test.ts`

**Interfaces:**
- Produces:
  - `interface Batcher { begin(command: DrawCommand): void; add(command: DrawCommand): void; draw(renderer: Renderer): void; }`
  - `interface NodeRenderer { readonly kind: DrawCommand["kind"]; matches(node: Node): boolean; buildCommand(node: Node): DrawCommand | null; createBatcher(renderer: Renderer): Batcher; }`
  - `abstract class NodeRendererBase<TNode extends Node, TData>` with `protected static readonly RENDER_STATES: Record<BlendMode, RenderState>`, `protected computeSortKey(zIndex: number, batchId: number): number`, `protected getOrCreateRenderData(node: TNode): TData`, and `protected abstract createRenderData(): TData`.
- Consumes: `computeModelWorldBound` (Task 1); `SpriteDrawCommand`/`ShapeDrawCommand` (`DrawCommand.ts`).

- [ ] **Step 1: Create `NodeRenderer.ts`** (both interfaces):

```ts
import { Node } from "../graphics";
import { Renderer } from "../core";
import { DrawCommand } from "./DrawCommand";

export interface Batcher {
  begin(command: DrawCommand): void;
  add(command: DrawCommand): void;
  draw(renderer: Renderer): void;
}

export interface NodeRenderer {
  readonly kind: DrawCommand["kind"];
  matches(node: Node): boolean;
  buildCommand(node: Node): DrawCommand | null;
  createBatcher(renderer: Renderer): Batcher;
}
```

- [ ] **Step 2: Write the failing test** — `packages/nebula/test/NodeRendererBase.test.ts` (exercises the shared base via a minimal concrete subclass, no GPU):

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
  public sortKey(zIndex: number, batchId: number): number {
    return this.computeSortKey(zIndex, batchId);
  }
  public data(node: Node): Data {
    return this.getOrCreateRenderData(node);
  }
}

describe("NodeRendererBase", () => {
  it("packs sort key as z-biased major, batch id minor, monotonic in z", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(0, 5)).toBe((0 + 32768) * 65536 + 5);
    expect(p.sortKey(1, 0)).toBeGreaterThan(p.sortKey(0, 65535));
  });

  it("clamps z into [0, 65535] after the +32768 bias", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(-40000, 0)).toBe(0 * 65536 + 0);
    expect(p.sortKey(40000, 0)).toBe(65535 * 65536 + 0);
  });

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

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/NodeRendererBase.test.ts`
Expected: FAIL — cannot resolve `NodeRendererBase`.

- [ ] **Step 4: Create `NodeRendererBase.ts`:**

```ts
import { BlendMode, RenderState } from "../core";
import { Node } from "../graphics";

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;

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

  protected computeSortKey(zIndex: number, batchId: number): number {
    const z: number = Math.min(
      Math.max(Math.round(zIndex) + Z_OFFSET, 0),
      Z_MAX,
    );

    return z * BATCH_RANGE + batchId;
  }

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

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/NodeRendererBase.test.ts`
Expected: PASS.

- [ ] **Step 6: Refactor `SpriteRenderer` onto the base + interface.** In `SpriteRenderer.ts`:
  - Remove the module-level `RENDER_STATES`, `Z_OFFSET`, `Z_MAX`, `BATCH_RANGE`, `BATCH_MAX` consts, the `computeSortKey` method, and the `getOrCreateRenderData` method (they move to / are replaced by the base). Keep `BATCH_MAX` logic inside `getBatchId` as a local const (`const BATCH_MAX: number = 65535;` there) since batch-id clamping is sprite-specific.
  - `export class SpriteRenderer extends NodeRendererBase<Sprite, SpriteRenderData> implements NodeRenderer`.
  - Add `public readonly kind = "sprite" as const;`
  - In the constructor call `super();` before the sampler setup; remove the `renderDataCache` field (now in base).
  - Implement `createRenderData(): SpriteRenderData { return { model: Mat4.identity(), uvRect: new Vec4(0, 0, 1, 1) }; }`.
  - `matches(node: Node): boolean { return node instanceof Sprite; }`
  - `buildCommand(node: Node): SpriteDrawCommand` — keep the existing body but take `node: Node`, narrow with `const sprite = node as Sprite;` at the top (it is only ever called after `matches`); use `NodeRendererBase.RENDER_STATES[sprite.blend]` and `this.computeSortKey(sprite.zIndex, this.getBatchId(materialKey))`.
  - `createBatcher(renderer: Renderer): Batcher { return new SpriteBatcher(renderer.createSpriteBatch()); }` (import `SpriteBatcher` from `./Batchers`, `Batcher`/`NodeRenderer` from `./NodeRenderer`).

- [ ] **Step 7: Refactor `ShapeRenderer` onto the base + interface.** In `ShapeRenderer.ts`:
  - Remove the module-level `RENDER_STATES`, `Z_OFFSET`, `Z_MAX`, `BATCH_RANGE` consts, the `computeSortKey` method, and the `getOrCreateRenderData` method. Keep `SHAPE_KIND_FILL`/`SHAPE_KIND_CIRCLE` and `BATCH_IDS` (shape-specific).
  - `export class ShapeRenderer extends NodeRendererBase<Shape, ShapeRenderData> implements NodeRenderer`.
  - Add `public readonly kind = "shape" as const;` and `super();` in the constructor.
  - `createRenderData(): ShapeRenderData { return { model: Mat4.identity(), color: new Vec4(1, 1, 1, 1), params: new Vec4(0, 0, 0, 0) }; }`.
  - `matches(node: Node): boolean { return node instanceof Shape; }`
  - `buildCommand(node: Node): ShapeDrawCommand | null` — keep body, narrow `const shape = node as Shape;`, use `NodeRendererBase.RENDER_STATES[shape.blend]` and `this.computeSortKey(shape.zIndex, BATCH_IDS[shape.blend])`.
  - `createBatcher(renderer: Renderer): Batcher { return new ShapeBatcher(renderer.createShapeBatch()); }`.
  - Keep `getWorldBound` (delegating to the helper from Task 1) — Phase 3 removes it.

- [ ] **Step 8: Export the new modules.** In `index.ts` add:

```ts
export * from "./NodeRenderer";
export * from "./NodeRendererBase";
```

- [ ] **Step 9: Build + full nebula suite**

Run: `pnpm --filter @atlasjs/nebula build` → PASS (SceneRenderer still constructs both renderers and uses `buildCommand`; signatures widened to `Node` are compatible).
Run: `pnpm --filter @atlasjs/nebula test` → PASS (worldBound + NodeRendererBase + the 5 pre-existing suites).

- [ ] **Step 10: Commit checkpoint** (suggested): `refactor(nebula): NodeRenderer seam + shared NodeRendererBase (E3)`.

---

## Phase 3 — Task 3: `RenderQueue` registry + generic `SceneRenderer`

**Why last:** with the renderers already carrying `kind`/`matches`/`createBatcher` and a shared base, the dispatch machinery can go fully generic: `RenderQueue` dispatches by `kind` through a registry, and `SceneRenderer.collect` iterates a list of `NodeRenderer`s with one uniform build→bound→cull→submit path. This is the change that removes the hardcoded `if/else` and `instanceof` chain.

**Files:**
- Modify: `packages/nebula/src/renderers/Batchers.ts` (implement `Batcher`)
- Modify: `packages/nebula/src/renderers/RenderQueue.ts` (registry)
- Modify: `packages/nebula/src/renderers/SceneRenderer.ts` (generic collect)
- Modify: `packages/nebula/src/renderers/ShapeRenderer.ts` (remove now-unused `getWorldBound`)
- Test: `packages/nebula/test/RenderQueue.test.ts`

**Interfaces:**
- Produces: `RenderQueue.register(kind: string, batcher: Batcher): void`; `RenderQueue.flush(renderer: Renderer): void`.
- Consumes: `Batcher`, `NodeRenderer` (Task 2); `computeModelWorldBound` (Task 1).

- [ ] **Step 1: Make the batchers implement `Batcher`.** In `Batchers.ts`, import `Batcher` and `DrawCommand`, and change the two classes to `implements Batcher`, widening the `begin`/`add` params to `DrawCommand` with an internal cast (safe: the registry only routes a batcher its own kind):

```ts
import { Renderer } from "../core";
import { DrawCommand, SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";
import { Batcher } from "./NodeRenderer";

export class SpriteBatcher implements Batcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: SpriteDrawCommand = command as SpriteDrawCommand;
    this.batch.begin(c.texture, c.sampler, c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: SpriteDrawCommand = command as SpriteDrawCommand;
    this.batch.add(c.model, c.uvRect, c.tint);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
```

(and the analogous `ShapeBatcher` using `ShapeDrawCommand` — `begin(c.renderState)`, `add(c.model, c.color, c.params)`). Keep the `SpriteBatch`/`ShapeBatch` imports from `../core`.

- [ ] **Step 2: Write the failing test** — `packages/nebula/test/RenderQueue.test.ts` (fake `Batcher`s + minimal commands; asserts run-batching + dispatch by kind, output-order preserving):

```ts
import { describe, it, expect } from "vitest";

import { RenderQueue } from "../src/renderers/RenderQueue";
import { Batcher } from "../src/renderers/NodeRenderer";
import { DrawCommand } from "../src/renderers/DrawCommand";

type Ev = string;

function recorder(tag: string, log: Ev[]): Batcher {
  return {
    begin: (c: DrawCommand): void => log.push(`${tag}.begin:${c.batchKey}`),
    add: (c: DrawCommand): void => log.push(`${tag}.add:${c.batchKey}`),
    draw: (): void => log.push(`${tag}.draw`),
  };
}

function cmd(kind: string, sortKey: number, batchKey: number): DrawCommand {
  return { kind, sortKey, batchKey } as unknown as DrawCommand;
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/RenderQueue.test.ts`
Expected: FAIL — `register` is not a function / `flush` arity mismatch.

- [ ] **Step 4: Rewrite `RenderQueue` with the registry:**

```ts
import { Renderer } from "../core";
import { DrawCommand } from "./DrawCommand";
import { Batcher } from "./NodeRenderer";

export class RenderQueue {
  private readonly commands: DrawCommand[];
  private readonly batchers: Map<string, Batcher>;

  public constructor() {
    this.commands = [];
    this.batchers = new Map();
  }

  public register(kind: string, batcher: Batcher): void {
    this.batchers.set(kind, batcher);
  }

  public submit(command: DrawCommand): void {
    this.commands.push(command);
  }

  public sort(): void {
    this.commands.sort((a: DrawCommand, b: DrawCommand) => a.sortKey - b.sortKey);
  }

  public flush(renderer: Renderer): void {
    let i: number = 0;

    while (i < this.commands.length) {
      const first: DrawCommand = this.commands[i];
      const batcher: Batcher | undefined = this.batchers.get(first.kind);

      if (!batcher) {
        i++;
        continue;
      }

      batcher.begin(first);

      let j: number = i;
      while (
        j < this.commands.length &&
        this.isSameRun(this.commands[j], first.kind, first.batchKey)
      ) {
        batcher.add(this.commands[j]);
        j++;
      }

      batcher.draw(renderer);
      i = j;
    }
  }

  public clear(): void {
    this.commands.length = 0;
  }

  private isSameRun(
    command: DrawCommand,
    kind: string,
    batchKey: number,
  ): boolean {
    return command.kind === kind && command.batchKey === batchKey;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/RenderQueue.test.ts`
Expected: PASS.

- [ ] **Step 6: Make `SceneRenderer.collect` generic.** Rewrite `SceneRenderer.ts`:

```ts
import { Bound } from "@atlasjs/math";

import { PassDescriptor, Renderer } from "../core";
import { SceneGraph } from "../scene";
import { Node } from "../graphics";
import { RenderQueue } from "./RenderQueue";
import { SpriteRenderer } from "./SpriteRenderer";
import { ShapeRenderer } from "./ShapeRenderer";
import { NodeRenderer } from "./NodeRenderer";
import { DrawCommand } from "./DrawCommand";
import { computeModelWorldBound } from "./worldBound";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly nodeRenderers: ReadonlyArray<NodeRenderer>;
  private readonly queue: RenderQueue;
  private readonly worldBoundScratch: Bound;

  private cameraViewport: Bound;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.nodeRenderers = [new SpriteRenderer(renderer), new ShapeRenderer()];
    this.queue = new RenderQueue();
    this.worldBoundScratch = new Bound();
    this.cameraViewport = new Bound();

    for (let i: number = 0; i < this.nodeRenderers.length; i++) {
      const nr: NodeRenderer = this.nodeRenderers[i];
      this.queue.register(nr.kind, nr.createBatcher(renderer));
    }
  }

  public render(scene: SceneGraph, pass?: PassDescriptor): void {
    scene.updateWorldMatrices();
    this.cameraViewport = this.renderer.getCameraViewport();

    this.queue.clear();
    this.collect(scene.root);
    this.queue.sort();

    this.renderer.beginFrame(pass);
    this.queue.flush(this.renderer);
    this.renderer.endFrame();
  }

  private collect(node: Node): void {
    if (!node.visible) return;

    for (let i: number = 0; i < this.nodeRenderers.length; i++) {
      const nr: NodeRenderer = this.nodeRenderers[i];

      if (nr.matches(node)) {
        const command: DrawCommand | null = nr.buildCommand(node);

        if (command) {
          const bound: Bound = computeModelWorldBound(
            command.model,
            this.worldBoundScratch,
          );

          if (this.cameraViewport.overlaps(bound)) {
            this.queue.submit(command);
          }
        }

        break;
      }
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i: number = 0; i < children.length; i++) {
      this.collect(children[i]);
    }
  }
}
```

Note: `DrawCommand` has a `model` on every variant, so `command.model` is always valid for culling.

- [ ] **Step 7: Remove the now-unused `ShapeRenderer.getWorldBound`.** In `ShapeRenderer.ts`, delete the `getWorldBound` method (SceneRenderer now culls via `computeModelWorldBound`). Grep to confirm no other caller: `grep -rn "\.getWorldBound(" packages/nebula/src` should show only `Sprite`/`Node`-level usages, not `ShapeRenderer`. Remove the now-unused `Bound` import from `ShapeRenderer.ts` if nothing else uses it.

- [ ] **Step 8: Build + full suite**

Run: `pnpm --filter @atlasjs/nebula build` → PASS.
Run: `pnpm --filter @atlasjs/nebula test` → PASS (all suites).
Run: `pnpm --filter @atlasjs/nebula-webgpu build` → PASS (consumes nebula; catches any exported-type break).

- [ ] **Step 9: Runtime verification** — start `apps/webgpu` via the preview tools, render, screenshot. Confirm: frame visually identical (sprite + rect + circle + line, black clear), console/network clean, no errors. Because sprites now build-then-cull on the command-model bound (equivalent to the old node-bound), the submitted set and z-order are unchanged.

- [ ] **Step 10: Commit checkpoint** (suggested): `refactor(nebula): generic RenderQueue registry + SceneRenderer dispatch (E3)`.

- [ ] **Step 11:** Mark E3 ✅ in `docs/renderer-backlog.md` (entry §E3 + "Ordre conseillé" item 8), noting the new-kind surface is now: a `NodeRenderer` subclass + one entry in `SceneRenderer.nodeRenderers` + a concrete `DrawCommand` union member (down from 6 sites; `flush`/`collect`/batcher-wiring no longer edited).

---

## Verification summary

| Task | Unit-tested (pure) | Build | Runtime preview |
|---|---|---|---|
| 1 | `computeModelWorldBound` identity/scale/translate | nebula | — |
| 2 | `NodeRendererBase` sort-key packing/clamp + data cache | nebula | — |
| 3 | `RenderQueue` run-batching + kind dispatch | nebula + nebula-webgpu | frame identical, console clean |

**Runtime baseline:** before starting, note the current `apps/webgpu` frame (sprite + rect + circle + line on black). Compare after Task 3.

---

## Self-review

- **Spec coverage (backlog §E3):** the 6 sites → (1) `DrawCommand` union — kept concrete by design; (2) `SceneRenderer.collect` instanceof chain → generic `matches` loop (Task 3); (3) batcher construction → `NodeRenderer.createBatcher` + registry (Tasks 2–3); (4) `RenderQueue.flush` if/else → registry dispatch (Task 3); (5) two twin `Batcher`s → `Batcher` interface (Task 3, dedup of `draw`; `begin`/`add` genuinely differ per batch API so stay as thin adapters behind the interface); (6) `SpriteRenderer`/`ShapeRenderer` dup (`RENDER_STATES`, z-packing, `computeSortKey`, `getOrCreateRenderData`) → `NodeRendererBase` (Task 2). ✅
- **Type consistency:** `NodeRenderer.kind: DrawCommand["kind"]`, `Batcher.{begin,add}(DrawCommand)`, `RenderQueue.register(string, Batcher)`/`flush(Renderer)`, `NodeRendererBase<TNode, TData>.{computeSortKey(number, number), getOrCreateRenderData(TNode), createRenderData(): TData}` used consistently across Tasks 2–3. ✅
- **Placeholders:** none — every code step shows the change; device-bound wiring is verified by build + preview, pure logic by vitest. ✅
- **Behavior preservation:** culling equivalence (sprite command-model AABB = `Sprite.getWorldBound`) proven in the plan header; run-batching and sort remain `sortKey`-ordered with `(kind, batchKey)` runs; `RENDER_STATES`/z-packing/`BATCH_IDS` values copied verbatim. ✅
