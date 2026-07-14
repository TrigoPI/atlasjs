# Shapes / Primitives Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render filled colored rects, circles and lines through Nebula's scene graph, reusing the instanced storage-buffer batch path, with correct z-interleaving against sprites.

**Architecture:** The three primitives are all instanced unit quads sharing one `Instance { model, color, params }` struct and one built-in `"shape"` shader (the fragment shader carves a disc via SDF when `params.x` marks a circle; rects and lines are solid fills, a line being an oriented thin rect). A single sorted `RenderQueue` interleaves sprite and shape commands by `sortKey`; `flush` dispatches runs to a per-kind batcher. The WebGPU sprite/shape batches share an internal `WebGPUInstancedBatch` base, and a single unified `drawInstancedBatch(batch)` replaces `drawSpriteBatch` (binding the material group only when the batch has one).

**Tech Stack:** TypeScript, WebGPU (`@webgpu/types`), WGSL, `wgsl_reflect`, tsdown build, pnpm + turborepo, Vite (apps).

## Global Constraints

- **Core stays backend-agnostic:** no `@webgpu/types`, no WGSL, no backend import anywhere under `packages/nebula/src`. (Root `CLAUDE.md`, nebula `AGENTS.md`.)
- **Renderers never import a backend:** shaders are obtained via `ResourceFactory`/`getBuiltinShader`, never by importing WGSL. (nebula `AGENTS.md`.)
- **WGSL is the single source of truth; reflection is the layout authority** — never hand-compute std140/std430; the only value→bytes path is `BindingGroupLayoutHelper`. (nebula-webgpu `AGENTS.md`.)
- **Always type the code, even trivially** (function params, variables, class members). **Do not add comments.** (Root `CLAUDE.md`.)
- **Three bind groups:** `group 0` = frame globals (injected), `group 1` = per-object/renderer (storage for instanced), `group 2+` = user material. Shapes have no material group. (nebula-webgpu `AGENTS.md`.)
- **Verification is build + visual** (no unit-test harness in `nebula`/`nebula-webgpu`). Per-package typecheck: `pnpm --filter @atlasjs/nebula build` and `pnpm --filter @atlasjs/nebula-webgpu build`. Visual validation via the `webgpu` app.
- **Do not commit automatically beyond the per-task commits in this plan; do not amend/rebase.** Commit messages follow the repo's conventional style (`feat(nebula): …`, `refactor(nebula-webgpu): …`).

---

## File Structure

**`@atlasjs/nebula` (core)**
- `graphics/Shape.ts` — base shape node; gains a `blend` field. *(modify)*
- `graphics/Circle.ts` — new circle node (`radius`). *(create)*
- `graphics/Line.ts` — new line node (`start`/`end`/`thickness`). *(create)*
- `graphics/index.ts` — export `Circle`, `Line`. *(modify)*
- `core/renderer/SpriteBatch.ts` — add `InstancedBatch` base interface + `ShapeBatch`. *(modify)*
- `core/renderer/Renderer.ts` — `drawSpriteBatch` → `drawInstancedBatch`. *(modify)*
- `core/renderer/ResourceFactory.ts` — add `createShapeBatch()`. *(modify)*
- `core/renderer/index.ts` — export new types. *(modify, verify)*
- `renderers/DrawCommand.ts` — union `SpriteDrawCommand | ShapeDrawCommand`. *(modify)*
- `renderers/SpriteRenderer.ts` — stamp `kind: "sprite"`. *(modify)*
- `renderers/ShapeRenderer.ts` — build shape commands + world bound. *(create)*
- `renderers/Batchers.ts` — `SpriteBatcher`, `ShapeBatcher`. *(create)*
- `renderers/RenderQueue.ts` — kind-aware run dispatch. *(modify)*
- `renderers/SceneRenderer.ts` — dispatch sprites/shapes + shape cull. *(modify)*
- `renderers/index.ts` — export new units. *(modify)*

**`@atlasjs/nebula-webgpu` (backend)**
- `batch/WebGPUInstancedBatch.ts` — shared instanced base. *(create)*
- `batch/WebGPUSpriteBatch.ts` — derive from base. *(modify)*
- `batch/WebGPUShapeBatch.ts` — new shape batch. *(create)*
- `batch/index.ts` — export `WebGPUShapeBatch`, `WebGPUInstancedBatch`. *(modify)*
- `shaders/shape_instanced.wgsl` — shape shader. *(create)*
- `resources/WebGPUShaderList.ts` — register built-in `"shape"`. *(modify)*
- `WebGPURenderer.ts` — `drawInstancedBatch`, `createShapeBatch`, optional material group. *(modify)*

**Apps**
- `apps/webgpu/src/index.ts` — demo shapes + z-interleave. *(modify)*

---

## Task 1: Shape nodes (Shape.blend, Circle, Line)

**Files:**
- Modify: `packages/nebula/src/graphics/Shape.ts`
- Create: `packages/nebula/src/graphics/Circle.ts`
- Create: `packages/nebula/src/graphics/Line.ts`
- Modify: `packages/nebula/src/graphics/index.ts`

**Interfaces:**
- Consumes: `Node` (`graphics/Node.ts`), `Color` (`utils/Color.ts`), `BlendMode` (`core/core-types.ts`), `Vec2` (`@atlasjs/math`).
- Produces:
  - `Shape` with `color: Color`, `blend: BlendMode` (default `"alpha"`), `setColor(r,g,b,a?)`, `setBlend(blend)`.
  - `class Circle extends Shape` with `radius: number` (get/set, maps to `transform.scale = (2r, 2r)`), `setRadius(r): this`.
  - `class Line extends Shape` with `start: Vec2`, `end: Vec2`, `thickness: number`, `setPoints(sx,sy,ex,ey): this`, `setThickness(t): this`.

- [ ] **Step 1: Add `blend` to `Shape`**

Replace `packages/nebula/src/graphics/Shape.ts` with:

```ts
import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";

export class Shape extends Node {
  public color: Color;
  public blend: BlendMode;

  public constructor() {
    super();
    this.color = new Color(1, 1, 1, 1);
    this.blend = "alpha";
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.color.set(r, g, b, a);
    return this;
  }

  public setBlend(blend: BlendMode): this {
    this.blend = blend;
    return this;
  }
}
```

- [ ] **Step 2: Create `Circle`**

Create `packages/nebula/src/graphics/Circle.ts`:

```ts
import { Shape } from "./Shape";

export class Circle extends Shape {
  public constructor(radius: number = 50) {
    super();
    this.setRadius(radius);
  }

  public get radius(): number {
    return this.transform.scale.x * 0.5;
  }

  public set radius(r: number) {
    this.transform.setScale(r * 2, r * 2);
  }

  public setRadius(r: number): this {
    this.transform.setScale(r * 2, r * 2);
    return this;
  }
}
```

- [ ] **Step 3: Create `Line`**

Create `packages/nebula/src/graphics/Line.ts`:

```ts
import { Vec2 } from "@atlasjs/math";
import { Shape } from "./Shape";

export class Line extends Shape {
  public readonly start: Vec2;
  public readonly end: Vec2;
  public thickness: number;

  public constructor(
    sx: number = 0,
    sy: number = 0,
    ex: number = 100,
    ey: number = 0,
    thickness: number = 1,
  ) {
    super();
    this.start = new Vec2(sx, sy);
    this.end = new Vec2(ex, ey);
    this.thickness = thickness;
  }

  public setPoints(sx: number, sy: number, ex: number, ey: number): this {
    this.start.set(sx, sy);
    this.end.set(ex, ey);
    return this;
  }

  public setThickness(thickness: number): this {
    this.thickness = thickness;
    return this;
  }
}
```

- [ ] **Step 4: Export new nodes**

In `packages/nebula/src/graphics/index.ts` add after the existing lines:

```ts
export * from "./Circle";
export * from "./Line";
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @atlasjs/nebula build`
Expected: builds successfully (emits `dist` + d.ts), no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/nebula/src/graphics
git commit -m "feat(nebula): add Circle and Line shape nodes, Shape.blend"
```

---

## Task 2: Unify the instanced draw path (no behavior change)

Pure refactor/rename. Sprite rendering must look identical afterwards. Introduces the `InstancedBatch` core interface, renames `drawSpriteBatch` → `drawInstancedBatch`, and extracts the WebGPU `WebGPUInstancedBatch` base with `WebGPUSpriteBatch` deriving from it. `drawInstancedBatch` reads the batch's own shader and binds the material group only when present (sprite always has one here, so behavior is unchanged).

**Files:**
- Modify: `packages/nebula/src/core/renderer/SpriteBatch.ts`
- Modify: `packages/nebula/src/core/renderer/Renderer.ts`
- Modify: `packages/nebula/src/renderers/RenderQueue.ts`
- Create: `packages/nebula-webgpu/src/batch/WebGPUInstancedBatch.ts`
- Modify: `packages/nebula-webgpu/src/batch/WebGPUSpriteBatch.ts`
- Modify: `packages/nebula-webgpu/src/batch/index.ts`
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts`

**Interfaces:**
- Consumes: `RenderState`, `Texture2D`, `Sampler`, `Mat4`, `Vec4`, `Disposable`; backend `WebGPUShader`, `WebGPUBindingGroup`, `WebGPUReflectedStorage`, `BindingGroupLayoutHelper`, `BindingValue`.
- Produces:
  - core `interface InstancedBatch extends Disposable { readonly __kind: string; readonly count: number; readonly renderState: RenderState; }`
  - core `interface SpriteBatch extends InstancedBatch { begin(texture, sampler, renderState): void; add(model, uvRect, tint): void; }`
  - core `Renderer.drawInstancedBatch(batch: InstancedBatch): void`
  - backend `abstract class WebGPUInstancedBatch` exposing `get shader(): WebGPUShader`, `get count`, `get renderState`, `get storageBinding`, `get byteSize`, `get materialBindings(): WebGPUBindingGroup | undefined`, `pack(): ArrayBuffer`, `destroy()`, and `protected abstract valueOf(index, name): BindingValue`.
  - backend `WebGPURenderer.drawInstancedBatch(batch: InstancedBatch)`.

- [ ] **Step 1: Add `InstancedBatch` to core `SpriteBatch.ts`**

Replace `packages/nebula/src/core/renderer/SpriteBatch.ts` with:

```ts
import { Mat4, Vec4 } from "@atlasjs/math";

import { Disposable } from "../utils";
import { RenderState } from "../core-types";
import { Texture2D, Sampler } from "../resources";

export interface InstancedBatch extends Disposable {
  readonly __kind: string;
  readonly count: number;
  readonly renderState: RenderState;
}

export interface SpriteBatch extends InstancedBatch {
  begin(texture: Texture2D, sampler: Sampler, renderState: RenderState): void;
  add(model: Mat4, uvRect: Vec4, tint: Vec4): void;
}
```

- [ ] **Step 2: Rename `drawSpriteBatch` in the `Renderer` interface**

In `packages/nebula/src/core/renderer/Renderer.ts`:
- Change the import `import { SpriteBatch } from "./SpriteBatch";` to `import { InstancedBatch } from "./SpriteBatch";`
- Change the method line `drawSpriteBatch(batch: SpriteBatch): void;` to:

```ts
  drawInstancedBatch(batch: InstancedBatch): void;
```

- [ ] **Step 3: Update the `RenderQueue` call site**

In `packages/nebula/src/renderers/RenderQueue.ts`, change line 37 `renderer.drawSpriteBatch(batch);` to:

```ts
      renderer.drawInstancedBatch(batch);
```

- [ ] **Step 4: Create the `WebGPUInstancedBatch` base**

Create `packages/nebula-webgpu/src/batch/WebGPUInstancedBatch.ts`:

```ts
import { WebGPUShader } from "../material";
import { WebGPUBindingGroup } from "../bindings";
import { WebGPUReflectedStorage } from "../reflect";

import {
  InstancedBatch,
  RenderState,
  BindingValue,
  BindingGroupLayoutHelper,
} from "@atlasjs/nebula";

export abstract class WebGPUInstancedBatch implements InstancedBatch {
  public readonly __kind: string = "webgpu";

  protected readonly shaderRef: WebGPUShader;
  protected readonly storage: WebGPUReflectedStorage;
  protected instanceCount: number;
  protected state: RenderState;

  public constructor(shader: WebGPUShader) {
    const storage: WebGPUReflectedStorage | undefined =
      shader.objectDefinition.storage;

    if (!storage) {
      throw new Error(
        "Instanced shader must declare a storage buffer in group 1.",
      );
    }

    this.shaderRef = shader;
    this.storage = storage;
    this.instanceCount = 0;
    this.state = { blend: "alpha", depthTest: false, cull: "none" };
  }

  public get shader(): WebGPUShader {
    return this.shaderRef;
  }

  public get count(): number {
    return this.instanceCount;
  }

  public get renderState(): RenderState {
    return this.state;
  }

  public get storageBinding(): number {
    return this.storage.binding;
  }

  public get byteSize(): number {
    return this.storage.stride * this.instanceCount;
  }

  public get materialBindings(): WebGPUBindingGroup | undefined {
    return undefined;
  }

  public pack(): ArrayBuffer {
    return BindingGroupLayoutHelper.packStorageArray(
      this.storage.stride,
      this.instanceCount,
      this.storage.members,
      (index: number, name: string): BindingValue => this.valueOf(index, name),
    );
  }

  public destroy(): void {
    this.instanceCount = 0;
  }

  protected abstract valueOf(index: number, name: string): BindingValue;
}
```

- [ ] **Step 5: Make `WebGPUSpriteBatch` derive from the base**

Replace `packages/nebula-webgpu/src/batch/WebGPUSpriteBatch.ts` with:

```ts
import { Mat4, Vec4 } from "@atlasjs/math";

import { WebGPUShader } from "../material";
import { WebGPUBindingGroup } from "../bindings";
import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import {
  SpriteBatch,
  Texture2D,
  Sampler,
  RenderState,
  BindingValue,
} from "@atlasjs/nebula";

export class WebGPUSpriteBatch
  extends WebGPUInstancedBatch
  implements SpriteBatch
{
  private readonly materialGroup: WebGPUBindingGroup;
  private readonly models: Mat4[];
  private readonly uvRects: Vec4[];
  private readonly tints: Vec4[];

  public constructor(shader: WebGPUShader) {
    super(shader);
    this.materialGroup = new WebGPUBindingGroup(shader.materialDefinition);
    this.models = [];
    this.uvRects = [];
    this.tints = [];
  }

  public override get materialBindings(): WebGPUBindingGroup {
    return this.materialGroup;
  }

  public begin(
    texture: Texture2D,
    sampler: Sampler,
    renderState: RenderState,
  ): void {
    this.instanceCount = 0;
    this.state = renderState;
    this.materialGroup.set("uTexture", texture).set("uSampler", sampler);
  }

  public add(model: Mat4, uvRect: Vec4, tint: Vec4): void {
    this.models[this.instanceCount] = model;
    this.uvRects[this.instanceCount] = uvRect;
    this.tints[this.instanceCount] = tint;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.materialGroup.destroy();
    this.models.length = 0;
    this.uvRects.length = 0;
    this.tints.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "model") return this.models[index];
    if (name === "uvRect") return this.uvRects[index];
    return this.tints[index];
  }
}
```

- [ ] **Step 6: Export the base**

In `packages/nebula-webgpu/src/batch/index.ts` add:

```ts
export * from "./WebGPUInstancedBatch";
```

- [ ] **Step 7: Rewrite `drawSpriteBatch` as `drawInstancedBatch`**

In `packages/nebula-webgpu/src/WebGPURenderer.ts`:

(a) Change the imported type `SpriteBatch` to also cover the base — update the `@atlasjs/nebula` import block to include `InstancedBatch` (keep `SpriteBatch`). Add `WebGPUInstancedBatch` to the `./batch` import.

Change:
```ts
import { WebGPUSpriteBatch, WebGPUInstanceBufferPool } from "./batch";
```
to:
```ts
import {
  WebGPUSpriteBatch,
  WebGPUInstancedBatch,
  WebGPUInstanceBufferPool,
} from "./batch";
```

In the `@atlasjs/nebula` import list, add `InstancedBatch,` next to `SpriteBatch,`.

(b) Replace the whole `public drawSpriteBatch(batch: SpriteBatch): void { … }` method (currently lines ~505-559) with:

```ts
  public drawInstancedBatch(batch: InstancedBatch): void {
    const ctx: WebGPURenderContext = this.assertContext();

    if (__DEV__) {
      WebGPUGuard.assertWebGPUInstancedBatch(batch);
    }

    const instanced: WebGPUInstancedBatch = batch as WebGPUInstancedBatch;

    if (instanced.count === 0) {
      return;
    }

    const shader: WebGPUShader = instanced.shader;
    const material: WebGPUBindingGroup | undefined = instanced.materialBindings;
    const hasMaterial: boolean = material !== undefined;

    const pipeline: GPURenderPipeline = this.getInstancedPipeline(
      shader,
      instanced.renderState,
      ctx.format,
      hasMaterial,
    );

    const globalLayout: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

    const storageLayout: GPUBindGroupLayout =
      this.getInstancedStorageLayout(shader);

    const globalCompiled: WebGPUCompiledBindingGroup =
      this.bindingGroupCache.get(this.globalBindings, globalLayout);

    const data: ArrayBuffer = instanced.pack();

    const storageBindGroup: GPUBindGroup = this.instancePool.acquire(
      data,
      instanced.byteSize,
      instanced.storageBinding,
      storageLayout,
    );

    this.assertBindGroup(globalCompiled.bindGroup);

    const pass: GPURenderPassEncoder = ctx.renderPass;
    pass.setPipeline(pipeline);
    pass.setBindGroup(BINDING_GROUP_GLOBAL, globalCompiled.bindGroup);
    pass.setBindGroup(BINDING_GROUP_OBJECT, storageBindGroup);

    if (material) {
      const materialLayout: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition);

      const materialCompiled: WebGPUCompiledBindingGroup =
        this.bindingGroupCache.get(material, materialLayout);

      this.assertBindGroup(materialCompiled.bindGroup);
      pass.setBindGroup(BINDING_GROUP_MATERIAL, materialCompiled.bindGroup);
    }

    pass.draw(6, instanced.count);
  }
```

(c) Update `getInstancedPipeline` to take `hasMaterial` and build the layout accordingly. Replace the method (currently lines ~214-265) with:

```ts
  private getInstancedPipeline(
    shader: WebGPUShader,
    renderState: RenderState,
    format: GPUTextureFormat,
    hasMaterial: boolean,
  ): GPURenderPipeline {
    const key: string = `${format}|${renderState.blend}|${renderState.cull}|${
      hasMaterial ? "m" : "n"
    }|${shader.id}`;

    const cached: GPURenderPipeline | undefined =
      this.instancedPipelines.get(key);

    if (cached) {
      return cached;
    }

    const globalLayout: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

    const storageLayout: GPUBindGroupLayout =
      this.getInstancedStorageLayout(shader);

    const bindGroupLayouts: GPUBindGroupLayout[] = [globalLayout, storageLayout];

    if (hasMaterial) {
      bindGroupLayouts.push(
        this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition),
      );
    }

    const layout: GPUPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    const pipeline: GPURenderPipeline = this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shader.module,
        entryPoint: shader.vertexEntryPoint,
      },
      fragment: {
        module: shader.module,
        entryPoint: shader.fragmentEntryPoint,
        targets: [
          {
            format,
            blend: WebGPUBlend.toBlendState(renderState.blend),
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: renderState.cull,
      },
    });

    this.instancedPipelines.set(key, pipeline);

    return pipeline;
  }
```

- [ ] **Step 8: Add the `WebGPUGuard.assertWebGPUInstancedBatch` guard**

In `packages/nebula-webgpu/src/utils/WebGPUGuard.ts`, add a guard mirroring `assertWebGPUSpriteBatch`. First inspect the existing sprite-batch guard:

Run: `grep -n "assertWebGPUSpriteBatch" packages/nebula-webgpu/src/utils/WebGPUGuard.ts`

Then add, next to it, a method that checks `batch.__kind === "webgpu"` (same shape as the existing sprite-batch guard — copy its body, rename to `assertWebGPUInstancedBatch`, keep the same error message style). If the existing guard checks `instanceof WebGPUSpriteBatch`, instead check `__kind === "webgpu"` here so both sprite and shape batches pass.

- [ ] **Step 9: Typecheck both packages**

Run: `pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/nebula-webgpu build`
Expected: both build, no type errors.

- [ ] **Step 10: Visual non-regression (sprites unchanged)**

Start the app and confirm sprites still render exactly as before.
- `preview_start` with `{ name: "webgpu" }`.
- `read_console_messages` (onlyErrors) and `preview_logs` (level error): expect **no** WebGPU errors.
- `computer { action: "screenshot" }`: the existing sealion sprite renders as before.

- [ ] **Step 11: Commit**

```bash
git add packages/nebula/src/core/renderer packages/nebula/src/renderers/RenderQueue.ts packages/nebula-webgpu/src/batch packages/nebula-webgpu/src/WebGPURenderer.ts packages/nebula-webgpu/src/utils/WebGPUGuard.ts
git commit -m "refactor(nebula): unify instanced draw path into drawInstancedBatch"
```

---

## Task 3: Shape batch infrastructure (interfaces, shader, backend batch)

Adds the `ShapeBatch` seam and its WebGPU implementation end-to-end so a shape batch can be created and drawn — but nothing wires it into the scene yet. This keeps the build green while isolating the GPU-side pieces for review.

**Files:**
- Modify: `packages/nebula/src/core/renderer/SpriteBatch.ts`
- Modify: `packages/nebula/src/core/renderer/ResourceFactory.ts`
- Create: `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl`
- Modify: `packages/nebula-webgpu/src/resources/WebGPUShaderList.ts`
- Create: `packages/nebula-webgpu/src/batch/WebGPUShapeBatch.ts`
- Modify: `packages/nebula-webgpu/src/batch/index.ts`
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts`

**Interfaces:**
- Consumes: `InstancedBatch`, `Mat4`, `Vec4`, `RenderState`, `BindingValue`, `WebGPUShader`.
- Produces:
  - core `interface ShapeBatch extends InstancedBatch { begin(renderState: RenderState): void; add(model: Mat4, color: Vec4, params: Vec4): void; }`
  - core `ResourceFactory.createShapeBatch(): ShapeBatch`
  - built-in shader `"shape"` (`Instance { model: mat4x4, color: vec4, params: vec4 }`, storage group 1 binding 0, no group 2).
  - backend `class WebGPUShapeBatch extends WebGPUInstancedBatch implements ShapeBatch` (no material bindings).
  - backend `WebGPURenderer.createShapeBatch(): WebGPUShapeBatch`.

- [ ] **Step 1: Add `ShapeBatch` to core `SpriteBatch.ts`**

Append to `packages/nebula/src/core/renderer/SpriteBatch.ts`:

```ts
export interface ShapeBatch extends InstancedBatch {
  begin(renderState: RenderState): void;
  add(model: Mat4, color: Vec4, params: Vec4): void;
}
```

- [ ] **Step 2: Add `createShapeBatch` to `ResourceFactory`**

In `packages/nebula/src/core/renderer/ResourceFactory.ts`:
- Change `import { SpriteBatch } from "./SpriteBatch";` to `import { SpriteBatch, ShapeBatch } from "./SpriteBatch";`
- After `createSpriteBatch(): SpriteBatch;` add:

```ts
  createShapeBatch(): ShapeBatch;
```

- [ ] **Step 3: Create the shape shader**

Create `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl`:

```wgsl
struct Instance {
  model: mat4x4<f32>,
  color: vec4<f32>,
  params: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> instances: array<Instance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) params: vec4<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
  );

  let instance = instances[instanceIndex];
  let corner = positions[vertexIndex];

  var out: VertexOutput;
  out.localPos = corner;
  out.color = instance.color;
  out.params = instance.params;
  out.position =
    uGlobal.viewProjection * instance.model * vec4<f32>(corner, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  var alpha: f32 = in.color.a;

  if (in.params.x > 0.5) {
    let dist: f32 = length(in.localPos);
    let edge: f32 = fwidth(dist);
    let coverage: f32 = 1.0 - smoothstep(0.5 - edge, 0.5, dist);
    alpha = alpha * coverage;
  }

  return vec4<f32>(in.color.rgb, alpha);
}
```

Note: `uGlobal` (group 0) is prepended to every shader by `WebGPUShaderCache` (from `global.wgsl`) — do not redeclare it here, mirroring `sprite_instanced.wgsl`.

- [ ] **Step 4: Register the built-in `"shape"` shader**

Replace `packages/nebula-webgpu/src/resources/WebGPUShaderList.ts` with:

```ts
import { ShaderDescriptor } from "@atlasjs/nebula";

import TextureShader from "../shaders/texture.wgsl";
import GlobalShader from "../shaders/global.wgsl";
import SpriteInstancedShader from "../shaders/sprite_instanced.wgsl";
import ShapeInstancedShader from "../shaders/shape_instanced.wgsl";

export const WebGPUShaders = (<T extends Record<string, ShaderDescriptor>>(
  list: T,
): Record<keyof T, ShaderDescriptor> => list)({
  Global: {
    id: "atlas.webgpu.Global",
    vertexEntryPoint: "",
    fragmentEntryPoint: "",
    source: GlobalShader,
  },
  Texture2D: {
    id: "atlas.webgpu.texture2d",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: TextureShader,
  },
  SpriteInstanced: {
    id: "atlas.webgpu.sprite_instanced",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: SpriteInstancedShader,
  },
  ShapeInstanced: {
    id: "atlas.webgpu.shape_instanced",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: ShapeInstancedShader,
  },
});

export const WebGPUBuiltinShaders: Record<string, ShaderDescriptor> = {
  sprite: WebGPUShaders.SpriteInstanced,
  texture: WebGPUShaders.Texture2D,
  shape: WebGPUShaders.ShapeInstanced,
};
```

- [ ] **Step 5: Create `WebGPUShapeBatch`**

Create `packages/nebula-webgpu/src/batch/WebGPUShapeBatch.ts`:

```ts
import { Mat4, Vec4 } from "@atlasjs/math";

import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import { ShapeBatch, RenderState, BindingValue } from "@atlasjs/nebula";

export class WebGPUShapeBatch
  extends WebGPUInstancedBatch
  implements ShapeBatch
{
  private readonly models: Mat4[] = [];
  private readonly colors: Vec4[] = [];
  private readonly params: Vec4[] = [];

  public begin(renderState: RenderState): void {
    this.instanceCount = 0;
    this.state = renderState;
  }

  public add(model: Mat4, color: Vec4, params: Vec4): void {
    this.models[this.instanceCount] = model;
    this.colors[this.instanceCount] = color;
    this.params[this.instanceCount] = params;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.models.length = 0;
    this.colors.length = 0;
    this.params.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "model") return this.models[index];
    if (name === "color") return this.colors[index];
    return this.params[index];
  }
}
```

- [ ] **Step 6: Export `WebGPUShapeBatch`**

In `packages/nebula-webgpu/src/batch/index.ts` add:

```ts
export * from "./WebGPUShapeBatch";
```

- [ ] **Step 7: Implement `createShapeBatch` in `WebGPURenderer`**

In `packages/nebula-webgpu/src/WebGPURenderer.ts`:
- Add `WebGPUShapeBatch` to the `./batch` import block.
- Add `ShapeBatch` to the `@atlasjs/nebula` import list.
- After the existing `createSpriteBatch()` method (~line 338-341) add:

```ts
  public createShapeBatch(): WebGPUShapeBatch {
    const shader: WebGPUShader = this.getBuiltinShader("shape");
    return new WebGPUShapeBatch(shader);
  }
```

- [ ] **Step 8: Typecheck both packages**

Run: `pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/nebula-webgpu build`
Expected: both build, no type errors.

- [ ] **Step 9: Commit**

```bash
git add packages/nebula/src/core/renderer packages/nebula-webgpu/src/shaders packages/nebula-webgpu/src/resources/WebGPUShaderList.ts packages/nebula-webgpu/src/batch packages/nebula-webgpu/src/WebGPURenderer.ts
git commit -m "feat(nebula-webgpu): add shape instanced shader and WebGPUShapeBatch"
```

---

## Task 4: Wire shapes into the render layer

Generalizes `DrawCommand` to a tagged union, adds `ShapeRenderer` + the two batchers, makes `RenderQueue` dispatch runs by `kind`, and makes `SceneRenderer` collect shapes with viewport culling. After this task, shapes drawn into the scene render and z-interleave with sprites.

**Files:**
- Modify: `packages/nebula/src/renderers/DrawCommand.ts`
- Modify: `packages/nebula/src/renderers/SpriteRenderer.ts`
- Create: `packages/nebula/src/renderers/ShapeRenderer.ts`
- Create: `packages/nebula/src/renderers/Batchers.ts`
- Modify: `packages/nebula/src/renderers/RenderQueue.ts`
- Modify: `packages/nebula/src/renderers/SceneRenderer.ts`
- Modify: `packages/nebula/src/renderers/index.ts`

**Interfaces:**
- Consumes: `Shape`, `Rect`, `Circle`, `Line` (`graphics`), `SpriteBatch`/`ShapeBatch`/`Renderer` (`core`), `Mat4`, `Vec4`, `Bound`.
- Produces:
  - `type DrawCommand = SpriteDrawCommand | ShapeDrawCommand` with common `{ kind, sortKey, batchKey, renderState }`.
  - `class ShapeRenderer` with `buildCommand(shape: Shape): ShapeDrawCommand | null` and `getWorldBound(command: ShapeDrawCommand, out: Bound): Bound`.
  - `class SpriteBatcher` / `class ShapeBatcher` (wrap a batch, expose `begin`/`add`/`draw`).
  - `RenderQueue.flush(renderer, sprites: SpriteBatcher, shapes: ShapeBatcher)`.

- [ ] **Step 1: Make `DrawCommand` a tagged union**

Replace `packages/nebula/src/renderers/DrawCommand.ts` with:

```ts
import { Mat4, Vec4 } from "@atlasjs/math";

import { RenderState } from "../core/core-types";
import { Texture2D, Sampler } from "../core/resources";

export type SpriteDrawCommand = {
  readonly kind: "sprite";
  readonly sortKey: number;
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
  readonly sortKey: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

export type DrawCommand = SpriteDrawCommand | ShapeDrawCommand;
```

- [ ] **Step 2: Stamp `kind: "sprite"` in `SpriteRenderer`**

In `packages/nebula/src/renderers/SpriteRenderer.ts`:
- Change the import `import { DrawCommand } from "./DrawCommand";` to `import { SpriteDrawCommand } from "./DrawCommand";`
- Change `buildCommand`'s return type from `DrawCommand` to `SpriteDrawCommand`.
- In the returned object literal (currently starting line 60), add `kind: "sprite",` as the first field:

```ts
    return {
      kind: "sprite",
      sortKey: this.computeSortKey(sprite, materialKey),
      batchKey: this.getBatchId(materialKey),
      texture: sprite.texture,
      sampler,
      renderState: RENDER_STATES[sprite.blend],
      model: data.model,
      uvRect: data.uvRect,
      tint: sprite.tint,
    };
```

- [ ] **Step 3: Create `ShapeRenderer`**

Create `packages/nebula/src/renderers/ShapeRenderer.ts`:

```ts
import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";

import { BlendMode, RenderState } from "../core";
import { Shape, Rect, Circle, Line } from "../graphics";
import { ShapeDrawCommand } from "./DrawCommand";

type ShapeRenderData = {
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

const SHAPE_KIND_FILL: number = 0;
const SHAPE_KIND_CIRCLE: number = 1;

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;

const RENDER_STATES: Record<BlendMode, RenderState> = {
  opaque: { blend: "opaque", depthTest: false, cull: "none" },
  alpha: { blend: "alpha", depthTest: false, cull: "none" },
  additive: { blend: "additive", depthTest: false, cull: "none" },
  multiply: { blend: "multiply", depthTest: false, cull: "none" },
};

const BATCH_IDS: Record<BlendMode, number> = {
  opaque: 0,
  alpha: 1,
  additive: 2,
  multiply: 3,
};

export class ShapeRenderer {
  private readonly renderDataCache: WeakMap<Shape, ShapeRenderData>;
  private readonly lineMatrixScratch: Mat4;

  public constructor() {
    this.renderDataCache = new WeakMap();
    this.lineMatrixScratch = Mat4.identity();
  }

  public buildCommand(shape: Shape): ShapeDrawCommand | null {
    const kind: number = this.shapeKindOf(shape);

    if (kind === -1) {
      return null;
    }

    const data: ShapeRenderData = this.getOrCreateRenderData(shape);

    this.updateColor(shape, data.color);
    data.params.set(kind, 0, 0, 0);
    this.updateModelMatrix(shape, data.model);

    return {
      kind: "shape",
      sortKey: this.computeSortKey(shape),
      batchKey: BATCH_IDS[shape.blend],
      renderState: RENDER_STATES[shape.blend],
      model: data.model,
      color: data.color,
      params: data.params,
    };
  }

  public getWorldBound(command: ShapeDrawCommand, out: Bound): Bound {
    const m: Float32Array = command.model.buffer;
    const m0: number = m[0];
    const m1: number = m[1];
    const m4: number = m[4];
    const m5: number = m[5];
    const m12: number = m[12];
    const m13: number = m[13];

    const corners: number[] = [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5];

    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;

    for (let i: number = 0; i < corners.length; i += 2) {
      const cx: number = corners[i];
      const cy: number = corners[i + 1];
      const px: number = m0 * cx + m4 * cy + m12;
      const py: number = m1 * cx + m5 * cy + m13;

      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }

    return out.set(minX, minY, maxX - minX, maxY - minY);
  }

  private shapeKindOf(shape: Shape): number {
    if (shape instanceof Circle) return SHAPE_KIND_CIRCLE;
    if (shape instanceof Rect) return SHAPE_KIND_FILL;
    if (shape instanceof Line) return SHAPE_KIND_FILL;
    return -1;
  }

  private getOrCreateRenderData(shape: Shape): ShapeRenderData {
    const cached: ShapeRenderData | undefined =
      this.renderDataCache.get(shape);

    if (cached) {
      return cached;
    }

    const data: ShapeRenderData = {
      model: Mat4.identity(),
      color: new Vec4(1, 1, 1, 1),
      params: new Vec4(0, 0, 0, 0),
    };

    this.renderDataCache.set(shape, data);

    return data;
  }

  private updateColor(shape: Shape, out: Vec4): void {
    out.set(shape.color.r, shape.color.g, shape.color.b, shape.color.a);
  }

  private computeSortKey(shape: Shape): number {
    const z: number = Math.min(
      Math.max(Math.round(shape.zIndex) + Z_OFFSET, 0),
      Z_MAX,
    );

    return z * BATCH_RANGE + BATCH_IDS[shape.blend];
  }

  private updateModelMatrix(shape: Shape, out: Mat4): void {
    if (shape instanceof Line) {
      this.updateLineMatrix(shape, out);
      return;
    }

    out.copy(shape.worldMatrix);
  }

  private updateLineMatrix(line: Line, out: Mat4): void {
    const start: Vec2 = line.start;
    const end: Vec2 = line.end;

    const dx: number = end.x - start.x;
    const dy: number = end.y - start.y;
    const length: number = Math.hypot(dx, dy);
    const angle: number = Math.atan2(dy, dx);
    const midX: number = (start.x + end.x) * 0.5;
    const midY: number = (start.y + end.y) * 0.5;

    this.lineMatrixScratch
      .identity()
      .translate(midX, midY, 0)
      .rotateZ(angle)
      .scale(length, line.thickness);

    out.copy(line.worldMatrix).multiply(this.lineMatrixScratch);
  }
}
```

- [ ] **Step 4: Create the batchers**

Create `packages/nebula/src/renderers/Batchers.ts`:

```ts
import { Renderer, SpriteBatch, ShapeBatch } from "../core";
import { SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";

export class SpriteBatcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: SpriteDrawCommand): void {
    this.batch.begin(command.texture, command.sampler, command.renderState);
  }

  public add(command: SpriteDrawCommand): void {
    this.batch.add(command.model, command.uvRect, command.tint);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}

export class ShapeBatcher {
  private readonly batch: ShapeBatch;

  public constructor(batch: ShapeBatch) {
    this.batch = batch;
  }

  public begin(command: ShapeDrawCommand): void {
    this.batch.begin(command.renderState);
  }

  public add(command: ShapeDrawCommand): void {
    this.batch.add(command.model, command.color, command.params);
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
```

- [ ] **Step 5: Generalize `RenderQueue.flush`**

Replace `packages/nebula/src/renderers/RenderQueue.ts` with:

```ts
import { Renderer } from "../core";
import { DrawCommand, SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";
import { SpriteBatcher, ShapeBatcher } from "./Batchers";

export class RenderQueue {
  private readonly commands: DrawCommand[];

  public constructor() {
    this.commands = [];
  }

  public submit(command: DrawCommand): void {
    this.commands.push(command);
  }

  public sort(): void {
    this.commands.sort(
      (a: DrawCommand, b: DrawCommand) => a.sortKey - b.sortKey,
    );
  }

  public flush(
    renderer: Renderer,
    sprites: SpriteBatcher,
    shapes: ShapeBatcher,
  ): void {
    let i: number = 0;

    while (i < this.commands.length) {
      const first: DrawCommand = this.commands[i];
      let j: number = i;

      if (first.kind === "sprite") {
        sprites.begin(first);

        // prettier-ignore
        while (j < this.commands.length && this.isSameRun(this.commands[j], "sprite", first.batchKey)) {
          sprites.add(this.commands[j] as SpriteDrawCommand);
          j++;
        }

        sprites.draw(renderer);
      } else {
        shapes.begin(first);

        // prettier-ignore
        while (j < this.commands.length && this.isSameRun(this.commands[j], "shape", first.batchKey)) {
          shapes.add(this.commands[j] as ShapeDrawCommand);
          j++;
        }

        shapes.draw(renderer);
      }

      i = j;
    }
  }

  public clear(): void {
    this.commands.length = 0;
  }

  private isSameRun(
    command: DrawCommand,
    kind: DrawCommand["kind"],
    batchKey: number,
  ): boolean {
    return command.kind === kind && command.batchKey === batchKey;
  }
}
```

- [ ] **Step 6: Dispatch shapes in `SceneRenderer`**

Replace `packages/nebula/src/renderers/SceneRenderer.ts` with:

```ts
import { Bound } from "@atlasjs/math";

import { PassDescriptor, Renderer, SpriteBatch, ShapeBatch } from "../core";
import { SceneGraph } from "../scene";
import { Node, Sprite, Shape } from "../graphics";
import { RenderQueue } from "./RenderQueue";
import { SpriteRenderer } from "./SpriteRenderer";
import { ShapeRenderer } from "./ShapeRenderer";
import { SpriteBatcher, ShapeBatcher } from "./Batchers";
import { ShapeDrawCommand } from "./DrawCommand";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly spriteRenderer: SpriteRenderer;
  private readonly shapeRenderer: ShapeRenderer;
  private readonly queue: RenderQueue;
  private readonly spriteBatcher: SpriteBatcher;
  private readonly shapeBatcher: ShapeBatcher;
  private readonly worldBoundScratch: Bound;

  private cameraViewport: Bound;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.spriteRenderer = new SpriteRenderer(renderer);
    this.shapeRenderer = new ShapeRenderer();
    this.queue = new RenderQueue();

    const spriteBatch: SpriteBatch = renderer.createSpriteBatch();
    const shapeBatch: ShapeBatch = renderer.createShapeBatch();
    this.spriteBatcher = new SpriteBatcher(spriteBatch);
    this.shapeBatcher = new ShapeBatcher(shapeBatch);

    this.worldBoundScratch = new Bound();
    this.cameraViewport = new Bound();
  }

  public render(scene: SceneGraph, pass?: PassDescriptor): void {
    scene.updateWorldMatrices();
    this.cameraViewport = this.renderer.getCameraViewport();

    this.queue.clear();
    this.collect(scene.root);
    this.queue.sort();

    this.renderer.beginFrame(pass);
    this.queue.flush(this.renderer, this.spriteBatcher, this.shapeBatcher);
    this.renderer.endFrame();
  }

  private collect(node: Node): void {
    if (!node.visible) return;

    if (node instanceof Sprite) {
      if (this.isSpriteVisible(node)) {
        this.queue.submit(this.spriteRenderer.buildCommand(node));
      }
    } else if (node instanceof Shape) {
      this.collectShape(node);
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i: number = 0; i < children.length; i++) {
      this.collect(children[i]);
    }
  }

  private collectShape(shape: Shape): void {
    const command: ShapeDrawCommand | null =
      this.shapeRenderer.buildCommand(shape);

    if (!command) return;

    const bound: Bound = this.shapeRenderer.getWorldBound(
      command,
      this.worldBoundScratch,
    );

    if (this.cameraViewport.overlaps(bound)) {
      this.queue.submit(command);
    }
  }

  private isSpriteVisible(sprite: Sprite): boolean {
    const spriteBounds: Bound = sprite.getWorldBound(this.worldBoundScratch);
    return this.cameraViewport.overlaps(spriteBounds);
  }
}
```

- [ ] **Step 7: Export new render-layer units**

In `packages/nebula/src/renderers/index.ts` add exports for the new files (match the existing export style):

```ts
export * from "./ShapeRenderer";
export * from "./Batchers";
```

Verify `DrawCommand` is already exported; if the file exports `./DrawCommand`, no change needed there.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/nebula-webgpu build`
Expected: both build, no type errors.

- [ ] **Step 9: Commit**

```bash
git add packages/nebula/src/renderers
git commit -m "feat(nebula): render shapes through the scene with z-interleave"
```

---

## Task 5: Demo scene + end-to-end visual validation

**Files:**
- Modify: `apps/webgpu/src/index.ts`

**Interfaces:**
- Consumes: `Rect`, `Circle`, `Line` from `@atlasjs/nebula`; existing `nebula.scene.addChild`, `setPosition`, `setZIndex`, `setColor`.

- [ ] **Step 1: Add shapes to the demo scene**

In `apps/webgpu/src/index.ts`:
- Add `Rect, Circle, Line` to the `@atlasjs/nebula` import.
- After the existing `nebula.scene.addChild(sealionSprite);` line, add a shapes block that interleaves z with the sprite (sealion is at its default `zIndex` 0):

```ts
  const bgRect: Rect = new Rect(300, 200);
  bgRect.setColor(0.15, 0.2, 0.45, 1).setPosition(0, 0).setZIndex(-1);

  const circle: Circle = new Circle(60);
  circle.setColor(0.9, 0.3, 0.3, 1).setPosition(160, -80).setZIndex(1);

  const line: Line = new Line(-200, 120, 200, 40, 6);
  line.setColor(0.2, 0.9, 0.4, 1).setZIndex(2);

  nebula.scene.addChild(bgRect);
  nebula.scene.addChild(circle);
  nebula.scene.addChild(line);
```

- [ ] **Step 2: Start the app**

Run `preview_start` with `{ name: "webgpu" }`.

- [ ] **Step 3: Check for GPU/console errors**

- `read_console_messages` with `onlyErrors: true` → expect none.
- `preview_logs` with `level: "error"` → expect none.

- [ ] **Step 4: Visual confirmation**

`computer { action: "screenshot" }` and confirm:
- A blue rectangle renders **behind** the sealion sprite (`zIndex -1`).
- A red circle renders **in front** (`zIndex 1`), with a smooth (antialiased) edge, not a square.
- A green line renders as an oriented thick segment (`zIndex 2`), on top.
- The sealion sprite still renders correctly (no regression).

If a shape is missing or mis-ordered, diagnose from source (model matrix / sort key / shader) before proceeding.

- [ ] **Step 5: Full build**

Run: `pnpm build`
Expected: turbo builds all packages green.

- [ ] **Step 6: Commit**

```bash
git add apps/webgpu/src/index.ts
git commit -m "feat(webgpu-app): demo rect, circle and line with sprite z-interleave"
```

---

## Self-Review Notes

- **Spec coverage:** §3 nodes → Task 1; §4.1 union → Task 4/Step 1; §4.2 ShapeRenderer → Task 4/Step 3; §4.3 RenderQueue batchers → Task 4/Steps 4-5; §4.4 SceneRenderer dispatch + cull → Task 4/Step 6; §4.5 interfaces + `drawInstancedBatch` → Task 2 + Task 3/Steps 1-2; §5.1 shader → Task 3/Step 3-4; §5.2 batch base → Task 2/Steps 4-5 + Task 3/Step 5; §5.3 unified draw → Task 2/Step 7; §8 verification → Tasks 2/10, 5; §10 order preserved.
- **Color→Vec4 bridge:** `ShapeRenderer.updateColor` converts the node's `Color` (`.r/.g/.b/.a`) into a cached `Vec4` (`.x/.y/.z/.w`) because the storage packer's `vec4` branch reads `.x/.y/.z/.w`. Mirrors sprite `tint`.
- **Line footprint / cull:** `getWorldBound` transforms the unit-quad corners by `command.model`, which is correct for all three shapes since each shape's `model` maps the unit quad onto its footprint (including the oriented line).
- **Green-at-every-commit:** interface renames (Task 2) land with all call sites; `createShapeBatch` (Task 3) lands with its backend implementation in the same task.
