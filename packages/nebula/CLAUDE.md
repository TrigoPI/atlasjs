# AGENTS.md — @atlasjs/nebula

Renderer module of AtlasJS (2D-first). **This package is the backend-agnostic layer**: rendering interfaces + engine logic that runs against those interfaces. The concrete WebGPU implementation lives in a separate package, `@atlasjs/nebula-webgpu`.

> Read `docs/shaders-materials-redesign.md` (implemented) and `docs/material-graph-serialization.md` (planned) at the repo root before touching the shader/material system.

## Responsibility

- `core/` — the public contracts: `Renderer`/`ResourceFactory`, `Shader`, `Material`, `BindingGroup`, `BindingGroupDefinition`, geometry/buffers/pipeline/resources/camera, plus `core-types`/`core-const` and `utils` (`BindingGroupLayoutHelper` value→bytes packing, `ShaderTypeGuard`).
- `renderers/` — `SpriteRenderer`, `SceneRenderer`: backend-agnostic, drive the `Renderer` interface only.
- `graphics/` (`Node`, `Sprite`, `Rect`, `Shape`, `Transformable`), `scene/` (`SceneGraph`), `animations/`, `camera`.
- `NebulaRenderer` (orchestrator), `NebulaPlugin`, `tokens`.

## Invariants — do not break

- **Backend-agnostic core.** No `@webgpu/types`, no WGSL, no import of any backend package anywhere under `nebula`. `TextureFormat`/`Topology` are hand-rolled string unions in `core-types.ts` (values chosen to match GPU literals), never `GPU*` aliases.
- **Renderers never import a backend.** A renderer obtains its shader from the backend via the `ResourceFactory` seam — e.g. `renderer.createSpriteShader()` — not by importing WGSL. If you add a built-in renderer that needs a shader, add a factory method to `ResourceFactory` and let the backend provide the source.
- **One value-setting API.** `Material` and `BindingGroup` expose a single `set(name, value)` (+ `get`). The expected type is derived from the binding definition and validated at runtime — there are no `setNumber`/`setColor`/… methods. Don't reintroduce per-type setters.
- **Definitions are read-only, reflection-derived.** `BindingGroupDefinition` has no `add`/builder. Binding metadata comes from shader reflection in the backend; this package only declares the shapes.

## Material/shader model (as of the redesign)

Shaders are authored in **WGSL as the single source of truth**; the backend reflects them to derive all binding layouts. This package holds only the interfaces. Uniform value types supported: `float`, `int`, `bool`, `vec2/3/4`, `mat3/mat4`, `color`, `buffer` (raw bytes), plus `texture2D`/`sampler` resources. `vec3/vec4/mat3` live in `@atlasjs/math`.

Planned (not implemented): material **instance serialization** (`MaterialData` POJO + `materialize`/`dematerialize` with injected resolvers) is intended to live here in the core — see `docs/material-graph-serialization.md` §3.

## Build

`pnpm build` (tsdown, ESM + d.ts). Depends on `@atlasjs/{assets,core,math,utils}`.
