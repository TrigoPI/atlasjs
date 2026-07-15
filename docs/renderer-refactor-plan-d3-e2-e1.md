# Renderer refactor D3 / E2 / E1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the instanced-draw state-desync (D3), unify the two pipeline systems behind one factory + one cache key (E2, absorbing D4), then split the `WebGPURenderer` god-object (E1).

**Architecture:** Three sequenced phases, each independently shippable and verifiable. D3 is a behavior fix routed through the existing `WebGPUBinder`; E2 is a behavior-preserving structural refactor introducing `WebGPUPipelineFactory`; E1 extracts `WebGPUSurface` + `WebGPUFrameGlobals`. Phase order matches the backlog and respects the one real dependency: E2 slims what E1 has to move.

**Tech Stack:** TypeScript, WebGPU (`@webgpu/types`), vitest, tsdown, pnpm/turbo monorepo.

## Global Constraints

- **Backend-agnostic core.** No `@webgpu/types`/WGSL in `@atlasjs/nebula`; all GPU code stays in `@atlasjs/nebula-webgpu`. (CLAUDE.md invariant.)
- **Reflection is the layout authority.** Never hand-compute WGSL alignment.
- **Type everything** (params, variables, class fields), even trivially. **No comments** in code.
- **No auto-commit.** Leave changes in the working tree; the user commits. Commit *checkpoints* below are suggested boundaries, not automated.
- **Device-bound code is verified by build + browser preview**, not unit tests — WebGPU is unavailable under Node/vitest. Only pure logic is unit-tested.
- These findings are specified in `docs/renderer-backlog.md` §D3, §E2 (+ §D4), §E1. Out of scope here: D5, D6.

---

## File Structure

**Phase 1 (D3):**
- Modify: `packages/nebula-webgpu/src/states/WebGPURenderState.ts` — `pipeline` tracks the raw `GPURenderPipeline`.
- Modify: `packages/nebula-webgpu/src/bindings/WebGPUBinder.ts` — add `setPipeline(ctx, GPURenderPipeline, shader?)`; `bindPipeline` delegates to it.
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts` — `drawInstancedBatch` routes pipeline + bind groups through the binder.
- Create: `packages/nebula-webgpu/vitest.config.ts`, add `test` script to `packages/nebula-webgpu/package.json`.
- Test: `packages/nebula-webgpu/test/WebGPUBinder.test.ts`.

**Phase 2 (E2 + D4):**
- Create: `packages/nebula-webgpu/src/pipeline/WebGPUPipelineFactory.ts`.
- Modify: `packages/nebula-webgpu/src/pipeline/WebGPUPipeline.ts` — static `computeKey`; optional geometry (instanced variant, no vertex buffer).
- Modify: `packages/nebula-webgpu/src/webgpu-types.ts` — `WebGPUPipelineDescriptor` geometry optional + `variant`.
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts` — delegate all pipeline creation to the factory; delete `getOrCreatePipeline`/`buildPipeline`/`getInstancedPipeline`/`getInstancedStorageLayout`/`instancedPipelines`/`instancedStorageLayout`/`pipelineCache`.
- Test: `packages/nebula-webgpu/test/WebGPUPipeline.test.ts`.

**Phase 3 (E1):**
- Create: `packages/nebula-webgpu/src/surface/WebGPUSurface.ts`.
- Create: `packages/nebula-webgpu/src/frame/WebGPUFrameGlobals.ts`.
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts` — delegate resize/canvas to surface, frame globals to `WebGPUFrameGlobals`.

**Runtime verification (every phase):** `apps/webgpu` dev server via the preview tools — render, screenshot, confirm the console/network are clean and the frame is visually identical to before the phase.

---

## Phase 1 — D3: route instanced draw through the binder

**Why first:** it fixes a real latent correctness bug (state desync when `draw()` and `drawInstancedBatch()` mix) and removes a dead optimization, and it is independent of E2 — the binder already dedups raw `GPUBindGroup`s; only pipeline tracking needs generalizing.

### Task 1.1: vitest harness for `nebula-webgpu`

**Files:**
- Create: `packages/nebula-webgpu/vitest.config.ts`
- Modify: `packages/nebula-webgpu/package.json` (scripts)

**Interfaces:**
- Produces: `pnpm --filter @atlasjs/nebula-webgpu test` runs vitest on `test/**/*.test.ts`.

- [ ] **Step 1: Create the vitest config**

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

- [ ] **Step 2: Add the test script** to `packages/nebula-webgpu/package.json` `scripts`, after `"dev"`:

```json
    "test": "vitest run",
```

- [ ] **Step 3: Commit checkpoint** (suggested): `chore(nebula-webgpu): add vitest harness`.

### Task 1.2: binder tracks raw pipeline identity

**Files:**
- Modify: `packages/nebula-webgpu/src/states/WebGPURenderState.ts`
- Modify: `packages/nebula-webgpu/src/bindings/WebGPUBinder.ts`
- Test: `packages/nebula-webgpu/test/WebGPUBinder.test.ts`

**Interfaces:**
- Produces: `WebGPUBinder.setPipeline(context: WebGPURenderContext, pipeline: GPURenderPipeline, shader?: WebGPUShader): void`; `WebGPURenderState.pipeline?: GPURenderPipeline`.
- Consumes (Task 1.3): `binder.setPipeline(...)` and existing `binder.bindGroup(ctx, group, GPUBindGroup)`.

- [ ] **Step 1: Write the failing test** — `packages/nebula-webgpu/test/WebGPUBinder.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { WebGPUBinder } from "../src/bindings";
import { WebGPURenderState } from "../src/states";
import { WebGPURenderContext } from "../src/states";

type Recorded = string[];

function fakeContext(): { ctx: WebGPURenderContext; calls: Recorded } {
  const calls: Recorded = [];
  const renderState: WebGPURenderState = new WebGPURenderState();
  const renderPass = {
    setPipeline: (p: GPURenderPipeline): void => {
      calls.push(`pipeline:${(p as unknown as { id: string }).id}`);
    },
  };
  const ctx = { renderPass, renderState } as unknown as WebGPURenderContext;
  return { ctx, calls };
}

describe("WebGPUBinder.setPipeline", () => {
  it("skips a redundant bind and re-binds after a different pipeline", () => {
    const { ctx, calls } = fakeContext();
    const binder: WebGPUBinder = new WebGPUBinder();
    const p1 = { id: "p1" } as unknown as GPURenderPipeline;
    const p2 = { id: "p2" } as unknown as GPURenderPipeline;

    binder.setPipeline(ctx, p1);
    binder.setPipeline(ctx, p1);
    binder.setPipeline(ctx, p2);
    binder.setPipeline(ctx, p1);

    expect(calls).toEqual(["pipeline:p1", "pipeline:p2", "pipeline:p1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula-webgpu exec vitest run test/WebGPUBinder.test.ts`
Expected: FAIL — `binder.setPipeline is not a function`.

- [ ] **Step 3: Change `WebGPURenderState.pipeline` to the raw handle**

In `WebGPURenderState.ts`, change the field type (and drop the now-unused `WebGPUPipeline` import if present):

```ts
  public pipeline?: GPURenderPipeline;
```

`reset()` already sets `this.pipeline = undefined;` — leave it.

- [ ] **Step 4: Add `setPipeline` and delegate `bindPipeline`**

In `WebGPUBinder.ts`, import the shader type and replace `bindPipeline`:

```ts
import { WebGPUShader } from "../material";
```

```ts
  public bindPipeline(
    context: WebGPURenderContext,
    pipeline: WebGPUPipeline,
  ): void {
    this.setPipeline(context, pipeline.pipeline, pipeline.descriptor.shader);
  }

  public setPipeline(
    context: WebGPURenderContext,
    pipeline: GPURenderPipeline,
    shader?: WebGPUShader,
  ): void {
    if (context.renderState.pipeline === pipeline) {
      return;
    }

    context.renderPass.setPipeline(pipeline);
    context.renderState.pipeline = pipeline;
    context.renderState.shader = shader;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/nebula-webgpu exec vitest run test/WebGPUBinder.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit checkpoint** (suggested): `refactor(nebula-webgpu): track raw pipeline in render state`.

### Task 1.3: `drawInstancedBatch` routes through the binder

**Files:**
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts` (`drawInstancedBatch`)

**Interfaces:**
- Consumes: `binder.setPipeline`, `binder.bindGroup`.

- [ ] **Step 1: Replace the direct `pass.*` calls** at the end of `drawInstancedBatch`. Current tail sets pipeline + bind groups directly on `pass` (`ctx.renderPass`). Replace with binder calls (keep the surrounding compilation of `globalCompiled` / `storageBindGroup` / `materialCompiled` unchanged):

```ts
    this.binder.setPipeline(ctx, pipeline, shader);
    this.binder.bindGroup(ctx, BINDING_GROUP_GLOBAL, globalCompiled.bindGroup);
    this.binder.bindGroup(ctx, BINDING_GROUP_OBJECT, storageBindGroup);

    if (material) {
      const materialLayout: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition);

      const materialCompiled: WebGPUCompiledBindingGroup =
        this.bindingGroupCache.get(material, materialLayout);

      this.assertBindGroup(materialCompiled.bindGroup);
      this.binder.bindGroup(
        ctx,
        BINDING_GROUP_MATERIAL,
        materialCompiled.bindGroup,
      );
    }

    ctx.renderPass.draw(6, instanced.count);
```

- [ ] **Step 2: Build both packages**

Run: `pnpm --filter @atlasjs/nebula-webgpu build`
Expected: build completes, d.ts emitted, no type errors.

- [ ] **Step 3: Runtime verification** — start `apps/webgpu` via preview tools, render the scene, screenshot. Confirm: frame visually identical to `main`, console clean, no WebGPU validation errors. (Bonus: the global bind group is now set once per frame instead of once per batch — verify no regression.)

- [ ] **Step 4: Commit checkpoint** (suggested): `fix(nebula-webgpu): route instanced draw through the binder (D3)`.

- [ ] **Step 5:** Mark D3 ✅ in `docs/renderer-backlog.md` (entry + "Ordre conseillé").

---

## Phase 2 — E2: unify pipeline creation (absorbs D4)

**Why:** two pipeline lifecycles, two caches, a fragment/blend/cull block duplicated, and a cache key computed in two places (`WebGPURenderer.getOrCreatePipeline` inline **and** `WebGPUPipeline.createPipelineId`). One factory + one key removes the drift risk and the storage-layout fragility (D4).

### Task 2.1: single source of truth for the pipeline key

**Files:**
- Modify: `packages/nebula-webgpu/src/pipeline/WebGPUPipeline.ts`
- Test: `packages/nebula-webgpu/test/WebGPUPipeline.test.ts`

**Interfaces:**
- Produces: `WebGPUPipeline.computeKey(spec: PipelineKeySpec): string` (static, pure). `PipelineKeySpec` exported from `webgpu-types.ts`:

```ts
export type PipelineKeySpec = {
  readonly variant: "indexed" | "instanced";
  readonly shaderId: string;
  readonly format: GPUTextureFormat;
  readonly blend: BlendMode;
  readonly cull: CullMode;
  readonly depthTest: boolean;
  readonly layoutId?: string;
  readonly hasMaterial?: boolean;
};
```

- [ ] **Step 1: Write the failing test** — `packages/nebula-webgpu/test/WebGPUPipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { WebGPUPipeline } from "../src/pipeline";
import { PipelineKeySpec } from "../src/webgpu-types";

const indexed: PipelineKeySpec = {
  variant: "indexed",
  shaderId: "s",
  format: "bgra8unorm",
  blend: "alpha",
  cull: "none",
  depthTest: false,
  layoutId: "v",
};

describe("WebGPUPipeline.computeKey", () => {
  it("is stable for equal specs", () => {
    expect(WebGPUPipeline.computeKey(indexed)).toBe(
      WebGPUPipeline.computeKey(indexed),
    );
  });

  it("varies with render state and variant", () => {
    const key: string = WebGPUPipeline.computeKey(indexed);
    expect(WebGPUPipeline.computeKey({ ...indexed, blend: "additive" })).not.toBe(key);
    expect(WebGPUPipeline.computeKey({ ...indexed, variant: "instanced", layoutId: undefined, hasMaterial: true })).not.toBe(key);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula-webgpu exec vitest run test/WebGPUPipeline.test.ts`
Expected: FAIL — `computeKey` not defined (and `PipelineKeySpec` missing).

- [ ] **Step 3: Add `PipelineKeySpec`** to `webgpu-types.ts` (import `BlendMode`, `CullMode` from `@atlasjs/nebula`) — the type above.

- [ ] **Step 4: Add the static `computeKey`** to `WebGPUPipeline`, and rewrite `createPipelineId()` to call it (single source of truth):

```ts
  public static computeKey(spec: PipelineKeySpec): string {
    return [
      spec.variant,
      spec.shaderId,
      spec.layoutId ?? "-",
      spec.format,
      spec.blend,
      spec.cull,
      spec.depthTest ? "d" : "n",
      spec.hasMaterial ? "m" : "n",
    ].join("|");
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/nebula-webgpu exec vitest run test/WebGPUPipeline.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit checkpoint** (suggested): `refactor(nebula-webgpu): single pipeline cache key (WebGPUPipeline.computeKey)`.

### Task 2.2: `WebGPUPipeline` supports the instanced variant

**Files:**
- Modify: `packages/nebula-webgpu/src/pipeline/WebGPUPipeline.ts`
- Modify: `packages/nebula-webgpu/src/webgpu-types.ts` (`WebGPUPipelineDescriptor`)

**Interfaces:**
- Produces: a `WebGPUPipeline` constructible with no geometry (instanced), exposing `.pipeline` (`GPURenderPipeline`), `.getBindGroupLayout(index)`, `.descriptor.shader`.

- [ ] **Step 1: Make geometry optional + add `variant`** in `webgpu-types.ts`:

```ts
export type WebGPUPipelineDescriptor = {
  readonly variant: "indexed" | "instanced";
  readonly shader: WebGPUShader;
  readonly renderState: RenderState;
  readonly format: GPUTextureFormat;
  readonly topology: GPUPrimitiveTopology;
  readonly layout: GPUPipelineLayout;
  readonly bindGroupLayouts: ReadonlyArray<GPUBindGroupLayout>;
  readonly geometry?: WebGPUGeometry;
};
```

(Drop the `PipelineDescriptor &` intersection — `renderState` is now declared explicitly here; `PipelineDescriptor` in core stays as-is for any future use.)

- [ ] **Step 2: Generalize the `WebGPUPipeline` constructor** to omit vertex buffers when there is no geometry:

```ts
    const buffers: GPUVertexBufferLayout[] = descriptor.geometry
      ? [WebGPUMapper.toGPUVertexBufferLayout(descriptor.geometry.vertexBuffer.layout)]
      : [];
```

and pass `buffers` into `vertex.buffers`. Make the `geometry` field on the class optional (`public readonly geometry?: WebGPUGeometry;`). Compute `this.id` via `WebGPUPipeline.computeKey({ variant: descriptor.variant, shaderId: descriptor.shader.id, layoutId: descriptor.geometry?.vertexBuffer.layout.getId(), format: descriptor.format, blend: descriptor.renderState.blend, cull: descriptor.renderState.cull, depthTest: descriptor.renderState.depthTest, hasMaterial: descriptor.bindGroupLayouts.length > 2 })`.

- [ ] **Step 3: Build**

Run: `pnpm --filter @atlasjs/nebula-webgpu build`
Expected: PASS (call sites still build; `WebGPURenderer` updated in Task 2.3).

- [ ] **Step 4: Commit checkpoint** (suggested): `refactor(nebula-webgpu): WebGPUPipeline supports instanced variant`.

### Task 2.3: `WebGPUPipelineFactory` owns all pipeline creation

**Files:**
- Create: `packages/nebula-webgpu/src/pipeline/WebGPUPipelineFactory.ts`
- Modify: `packages/nebula-webgpu/src/pipeline/index.ts` (export the factory)
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts`

**Interfaces:**
- Produces:
  - `getIndexed(shader: WebGPUShader, geometry: WebGPUGeometry, renderState: RenderState, format: GPUTextureFormat): WebGPUPipeline`
  - `getInstanced(shader: WebGPUShader, renderState: RenderState, format: GPUTextureFormat, hasMaterial: boolean): WebGPUPipeline`
  - `getStorageLayout(shader: WebGPUShader): GPUBindGroupLayout` — keyed by `storage.binding` (fixes D4)
  - `destroy(): void`

- [ ] **Step 1: Create `WebGPUPipelineFactory`** with a single `Map<string, WebGPUPipeline>` cache and a `Map<number, GPUBindGroupLayout>` for storage layouts. It moves the bodies of `buildPipeline`, `getInstancedPipeline`, and `getInstancedStorageLayout` verbatim (they already exist in `WebGPURenderer`), keying each `getOrCreate` by `WebGPUPipeline.computeKey(...)`, and constructing `WebGPUPipeline` with `variant`. `getStorageLayout` keys by `shader.objectDefinition.storage?.binding ?? 0`:

```ts
  public getStorageLayout(shader: WebGPUShader): GPUBindGroupLayout {
    const binding: number = shader.objectDefinition.storage?.binding ?? 0;
    let layout: GPUBindGroupLayout | undefined = this.storageLayouts.get(binding);

    if (!layout) {
      layout = this.device.createBindGroupLayout({
        entries: [
          {
            binding,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "read-only-storage" },
          },
        ],
      });
      this.storageLayouts.set(binding, layout);
    }

    return layout;
  }
```

- [ ] **Step 2: Wire `WebGPURenderer` to the factory.** In `init()`, `this.pipelineFactory = new WebGPUPipelineFactory(this.device, this.bindingGroupCache);`. In `draw()`, replace `this.getOrCreatePipeline(...)` with `this.pipelineFactory.getIndexed(mat.shader, geo, mat.renderState, ctx.format)`. In `drawInstancedBatch`, replace `this.getInstancedPipeline(...)` with `this.pipelineFactory.getInstanced(shader, instanced.renderState, ctx.format, hasMaterial)` and `this.getInstancedStorageLayout(shader)` with `this.pipelineFactory.getStorageLayout(shader)`. In `destroy()`, replace the pipeline/instanced cleanup with `this.pipelineFactory.destroy();`.

- [ ] **Step 3: Delete the dead members** from `WebGPURenderer`: `getOrCreatePipeline`, `buildPipeline`, `getInstancedPipeline`, `getInstancedStorageLayout`, and the fields `pipelineCache`, `instancedPipelines`, `instancedStorageLayout` (and their imports if now unused: `WebGPUPipelineCache`). Add `private pipelineFactory!: WebGPUPipelineFactory;`.

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlasjs/nebula-webgpu build`
Expected: PASS, no type errors.

- [ ] **Step 5: Run unit tests** (binder + pipeline key):

Run: `pnpm --filter @atlasjs/nebula-webgpu test`
Expected: PASS.

- [ ] **Step 6: Runtime verification** — `apps/webgpu`: render, screenshot, console/network clean, frame identical to pre-phase.

- [ ] **Step 7: Commit checkpoint** (suggested): `refactor(nebula-webgpu): unify pipeline creation behind WebGPUPipelineFactory (E2, D4)`.

- [ ] **Step 8:** Mark E2 ✅ and D4 ✅ in `docs/renderer-backlog.md`.

---

## Phase 3 — E1: split the `WebGPURenderer` god-object

**Why last:** with pipelines already extracted (Phase 2), the remaining cohesive lumps are the canvas/resize surface and the frame globals. Both are pure extractions — behavior preserved, verified by build + preview.

### Task 3.1: extract `WebGPUSurface`

**Files:**
- Create: `packages/nebula-webgpu/src/surface/WebGPUSurface.ts` (+ `surface/index.ts`)
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts`

**Interfaces:**
- Produces: `WebGPUSurface` owning `canvas`, `logicalWidth/Height`, `autoResize`, `resizeObserver`, and `resize`/`applyResize`/`onResizeEntries`/`getDevicePixelRatio`. Exposes `get logicalWidth()`, `get logicalHeight()`, `resize(w, h)`, `dispose()`, and takes an `onResize?` callback if the renderer needs to react (none needed today — the camera reads size at frame time).

- [ ] **Step 1:** Move the resize/canvas fields and methods verbatim from `WebGPURenderer` into `WebGPUSurface`. `WebGPURenderer` keeps a `private readonly surface: WebGPUSurface;`, delegates `resize(w, h)` to it, reads `this.surface.logicalWidth/Height` in `getCameraViewport` and frame-globals update. `destroy()` calls `this.surface.dispose()`.

- [ ] **Step 2: Build + runtime verification** — resize the browser window in the preview; confirm the canvas tracks size (HiDPI crisp) exactly as before.

Run: `pnpm --filter @atlasjs/nebula-webgpu build`
Expected: PASS.

- [ ] **Step 3: Commit checkpoint** (suggested): `refactor(nebula-webgpu): extract WebGPUSurface (E1)`.

### Task 3.2: extract `WebGPUFrameGlobals`

**Files:**
- Create: `packages/nebula-webgpu/src/frame/WebGPUFrameGlobals.ts` (+ `frame/index.ts`)
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts`

**Interfaces:**
- Produces: `WebGPUFrameGlobals` owning `globalBindings` (`WebGPUBindingGroup`) + `clock` (`Clock`), exposing `update(camera: Camera2D, width: number, height: number): void` (sets `viewProjection` + `time`) and `get bindings(): WebGPUBindingGroup`.

- [ ] **Step 1:** Move `globalBindings`, `clock`, `updateCamera`, `updateTime` into `WebGPUFrameGlobals`. `WebGPURenderer.beginFrame` calls `this.frameGlobals.update(this.camera, this.surface.logicalWidth, this.surface.logicalHeight)`; the global bind group used in `draw`/`drawInstancedBatch` comes from `this.frameGlobals.bindings`. The `globalBindingsDefinition` construction stays in `init()` and is passed to the `WebGPUFrameGlobals` constructor.

- [ ] **Step 2: Build + runtime verification** — render; confirm camera pan/zoom + any time-driven shader still animate identically.

Run: `pnpm --filter @atlasjs/nebula-webgpu build`
Expected: PASS.

- [ ] **Step 3: Commit checkpoint** (suggested): `refactor(nebula-webgpu): extract WebGPUFrameGlobals (E1)`.

- [ ] **Step 4:** Mark E1 ✅ in `docs/renderer-backlog.md`. Confirm `WebGPURenderer` is now materially smaller (device/context lifecycle + `ResourceFactory` + draw submission), and note the residual size in the backlog.

---

## Verification summary

| Phase | Unit-tested (pure) | Build | Runtime preview |
|---|---|---|---|
| D3 | binder dedup / state sync | both packages | frame identical, global bind set once/frame |
| E2 | `computeKey` stability/variance | both packages | frame identical, no validation errors |
| E1 | — | both packages | resize + camera + time identical |

**Runtime baseline:** before starting, capture a reference screenshot of `apps/webgpu` on the current `dev` branch. Compare after each phase.

---

## Self-review

- **Spec coverage:** D3 → Phase 1; E2 → Phase 2 Tasks 2.1–2.3; D4 → Task 2.3 Step 1 (`getStorageLayout` keyed by binding); E1 → Phase 3. D5/D6 explicitly out of scope. ✅
- **Type consistency:** `WebGPUBinder.setPipeline` / `WebGPURenderState.pipeline: GPURenderPipeline` used consistently across Tasks 1.2–1.3; `WebGPUPipeline.computeKey` / `PipelineKeySpec` used in 2.1–2.3; `WebGPUPipelineFactory.get{Indexed,Instanced,StorageLayout}` consumed only in 2.3 Step 2. ✅
- **Placeholders:** none — every code step shows the change; device-bound steps are explicitly "build + preview", not fake tests. ✅
