# AGENTS.md — @atlasjs/nebula-webgpu

The **WebGPU implementation** of the `@atlasjs/nebula` rendering interfaces. All WGSL, `@webgpu/types`, and GPU resource handling live here — never in `nebula` core.

> Read `memory/atlas/rendering/shaders-materials.md` (implemented) and `memory/atlas/rendering/material-graph.md` (planned) at the repo root before touching the shader/material system.

## Responsibility

Implements `Renderer`/`ResourceFactory` and every resource (`WebGPURenderer`, `WebGPUShader`, `WebGPUMaterial`, `WebGPUBindingGroup*`, buffers, geometry, pipeline, textures, sampler, caches). Depends on `@atlasjs/nebula` (interfaces + `BindingGroupLayoutHelper`/`ShaderTypeGuard`/`Color`), `@atlasjs/math`, `@atlasjs/utils`, and `wgsl_reflect`.

Key areas:
- `reflect/WebGPUReflection` — wraps `wgsl_reflect`; derives per-group layouts + entry points.
- `authoring/MaterialShaderBuilder` — `defineMaterial(source)`, the easy authoring path.
- `bindings/` — binding group, its reflected definition, layout (`WebGPUMaterialLayout.ts`), compiled bind group, binder.
- `resources/WebGPUShaderList` + `shaders/*.wgsl` — the backend's built-in shaders (`global.wgsl` prelude, `texture.wgsl` sprite shader).

## Core concepts — do not break

- **Reflection is the layout authority.** `wgsl_reflect` derives all binding metadata (groups, bindings, struct offsets/sizes). Never hand-compute WGSL std140/std430 alignment. The only value→bytes logic is `BindingGroupLayoutHelper.packUniformBuffer` (in nebula core), which writes at reflected offsets.
- **Three bind groups, injection = known by construction.** `group 0` = frame globals (`viewProjection`, `time`) from `global.wgsl`, prepended to *every* shader by `WebGPUShaderCache` and reflected. `group 1` = per-object/renderer data (e.g. `model`, `sourceRect`). `group 2+` = user material. Constants in `web-gpu-const.ts`.
- **Easy path.** `defineMaterial(source)` takes a `material { name: type, … }` block (NO `@group`/`@binding`) + a `@fragment` fn; `MaterialShaderBuilder` injects the object + standard 2D vertex preludes, auto-assigns material bindings (uniforms first at binding 0, then resources — no binding holes), then the result flows through the normal `createShader` → reflection pipeline. The easy path is sugar over the advanced (full-WGSL) path; both share one backend.
- **Binding group versioning** (`WebGPUBindingGroup`/`WebGPUCompiledBindingGroup`): `version` bumps on *any* `set()` → uniform buffer re-upload; `resourceVersion` bumps only on texture/sampler change → bind group rebuild. `set()` must **never** short-circuit on reference equality — values are often reused instances mutated in place (e.g. a per-frame model matrix), and skipping would freeze the GPU-side data.
- **Shader ids** default to a hash of the WGSL source; `WebGPUShaderCache` dedups by id. Entry points are auto-detected from `@vertex`/`@fragment` unless overridden in the `ShaderDescriptor`.

## Gotcha

`wgsl_reflect` ships its real ESM via the `module` field; its `main` is CJS. Vite/bundlers resolve the ESM build correctly. A bare named import under raw Node resolves the CJS build and fails — irrelevant for the app, but don't be surprised in Node scripts (import `wgsl_reflect/wgsl_reflect.module.js` there if needed).

This bites **Vitest** too, and `vitest.config.ts` carries the fix: a `resolve.alias` remaps `wgsl_reflect` onto its `wgsl_reflect.module.js` build. Any test that instantiates `WebGPUReflection` needs it — `test/WebGPUTrailBatch.test.ts` was the first to do so, which is why the alias appeared only recently. Don't remove it, and note the remap is written as a `.replace()` on the resolved `main` filename, so it silently no-ops if the package renames that file.

## WGSL

- **No `if` depending on `params` before a call to `fwidth`.** `fwidth` is a derivative builtin: WGSL forbids calling it from non-uniform control flow (`error: 'fwidth' must only be called from uniform control flow`). Compute the SDF and the derivative **unconditionally**, and express any decision that depends on `params` only through `select`. Applies to any future extension of the shapes shader (rounded corners, feather). Full detail: `memory/atlas/debug/gizmos.md` §6.2.
- After any `.wgsl` edit, `dist` must be rebuilt — a `PostToolUse` hook takes care of this.

## Build

`pnpm build` (tsdown, ESM + d.ts, `.wgsl` loaded as text). Must build after `@atlasjs/nebula` (turbo `^build` handles ordering). The future `@atlasjs/material-graph` will generate WGSL that flows through `createShader` here.
