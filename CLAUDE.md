# AGENTS.md

# AtlasJS

## Overview

AtlasJS is a modern game engine written in TypeScript.

It is designed as a modular, plugin-based engine where every major system can evolve independently while remaining part of a cohesive ecosystem.

The engine is **2D-first**, while its architecture should remain flexible enough to support future 3D capabilities without requiring a fundamental redesign.

This repository is a **Turborepo monorepo** managed with **pnpm**.

---

## Project Philosophy

AtlasJS is built around four core principles.

### Performance

Performance should be considered from the beginning of the design process.

Avoid unnecessary allocations, excessive abstraction overhead, and APIs that make efficient implementations difficult.

Abstractions should improve the architecture without hiding important runtime costs.

### Modularity

Every major system should have a clear and focused responsibility.

Shared engine capabilities should be isolated into independent packages with minimal coupling between them.

AtlasJS should behave as an ecosystem of composable modules rather than as a single monolithic engine.

### Plugin-based Architecture

The engine core should remain lightweight and independent from optional systems.

Rendering, physics, ECS, gameplay features, tooling, and future systems should integrate through well-defined extension points.

New capabilities should be introducible through plugins without requiring modifications to the engine core.

### Extensibility

AtlasJS should make it possible to add new systems, replace existing implementations, and experiment with alternative technologies.

Architectural decisions should favor long-term flexibility and clear extension points over short-term convenience.

---

## Repository Structure

The repository is divided into two main areas.

### `packages/`

The `packages` directory contains reusable libraries and engine modules.

This includes shared systems such as:

- Engine foundations
- Mathematics
- Plugin APIs
- Rendering
- Physics
- ECS
- Gameplay utilities
- Shared tooling

Packages should remain focused, reusable, and as independent as possible.

A package should not depend on an application from the `apps` directory.

### `apps/`

The `apps` directory contains executable applications built using AtlasJS packages.

This may include:

- Sandboxes
- Examples
- Development tools
- Editors
- Demo games
- Test applications

Applications may compose multiple packages together, but application-specific logic should not leak into reusable engine packages.

### `docs/`

The `docs` directory contains cross-cutting design documents and architecture decisions that span multiple packages or describe planned refactors. It is organized by domain (`rendering/`, `core/`, `gameplay/`), plus a single top-level backlog.

Consult it before undertaking a significant change: a design may already be validated and awaiting implementation. **Anything left to do lives in [`docs/backlog.md`](docs/backlog.md)** — check it first for pending work.

- `docs/backlog.md` — **single unified backlog**. Everything not yet done, grouped by domain (rendering, sprites/assets, shaders/materials, material-graph, ECS, scheduling, input scripting), each item pointing back to its design doc. Start here.

### `docs/rendering/`

- `docs/rendering/renderer-architecture.md` — **implemented**. Renderer submission-path refactor: adds the missing **render layer** between RHI and scene. Killed the `pipeline` argument of `draw()` (internal cached artifact resolved from `(shader, vertexLayout, RenderState)`; `Material` carries a `RenderState`), added `DrawCommand` + packed sort key + `RenderQueue`, a **storage-buffer + instancing** `SpriteBatch`, a `RenderPass`/`RenderTarget` seam (render-to-texture), and 3D-future openings (`Camera` interface, shader library via `getBuiltinShader`). All 6 phases + dirty-flag + per-sprite tint/blend done. §7 appendix absorbs the two post-refactor hardening plans (D3/E2/E1 backend, E3 `NodeRenderer` seam).
- `docs/rendering/shaders-materials.md` — **implemented**. Shader/material authoring API: WGSL as single source of truth via reflection, layered easy/advanced paths, package split. Remaining: Vite `.d.ts` codegen, `Sprite.material`, `ivec*` (→ backlog).
- `docs/rendering/sprites.md` — **implemented**. Sprite renderer redesign: `Sprite` asset (texture + region + pivot) + Unity-style `SpriteRendererComponent` façade over an L1 `SpriteRender` source-of-truth, rewritten `SpriteRenderSystem` with lifecycle cleanup; minimal `Asset` contract in `@atlasjs/assets`. (Absorbed its implementation plan.) Deferred: `AssetManager`, animation, blend/sampler (→ backlog).
- `docs/rendering/shapes.md` — **implemented** (renderer backlog A1). Filled 2D primitives (Rect/Circle/Line) as one instanced-quad path + built-in `"shape"` shader (circle via SDF). (Absorbed its implementation plan.) Deferred: strokes, rounded corners, polygons, gradient fill (→ backlog).
- `docs/rendering/canvas-resize.md` — **implemented**. `Renderer.resize(w, h)` in logical (CSS) pixels; physical backing store `× devicePixelRatio` for HiDPI, logical-pixel camera, expand model; auto-observe via `ResizeObserver` (opt-out `autoResize`), `NebulaRenderer.resize` passthrough.
- `docs/rendering/material-graph.md` — **vision (design only, not implemented)**. Material serialization (load/save) + node-graph material editor, code-first with the editor plugging onto the lib. Two tiers (material instance + graph template); graph compiles to WGSL through the existing pipeline. Entirely future work (→ backlog).

### `docs/core/`

- `docs/core/scheduling.md` — **implemented** (except Phase 3). Scheduling/loop refactor: single ordering authority (lanes → named stages → before/after), rollback-ready fixed step (`advanceFixed`, `fixedDelta` drives physics), declared plugin deps with topological boot, removable/groupable steps (`StepHandle`/`StepSet`), fixed→update→render loop with interpolation alpha. `scheduler.<lane>.add(fn, spec)` is the API; every lane ends with a trailing `Sync` stage (anchor 1000). **Phase 3 (Physics dt) still pending** (→ backlog).
- `docs/core/nexus-ecs.md` — **implemented** (+ `gameplay` migration). Nexus ECS: generational entities, swappable `IComponentStore` backend (sparse-set today), typed `world.query(...).each((e, a, b) => …)` with fail-fast structural-change guard, hybrid command buffer (`world.commands` + `world.flush()`, auto-flushed at `Sync`), multi-world via injectable `ComponentRegistry`, `without`/`optional` filters, `world.onAdd`/`onRemove`. Future: archetype/SoA backend, `Changed<T>` change-detection (→ backlog).

### `docs/gameplay/`

- `docs/gameplay/gameplay-redesign.md` — **implemented** (phases 0→6). Killed the shadow-ECS + diff/request/feedback pipeline in favor of a **single source of truth** per datum in Nexus, a **thin façade** for the script API, and a physics bridge with **authority declared by body type** (dynamic → physics, kinematic/static → transform) via `PhysicsPushSystem`/`PhysicsPullSystem` + `PhysicsBodyRef` handles. Removed `Vector2D` (use `Vec2`).
- `docs/gameplay/scripting-components.md` — **implemented**. Script component-access API on the final `defineScriptComponent` **token model**: single brand-based runtime dispatch, `Transform` and `CharacterController` as the two behavioral tokens (`Transform` routes physics authority + hierarchy/world-matrix, threading `entity` through proxies via an `ENTITY` symbol; `CharacterController` wraps rapier collide-and-slide), `RigidBody`/`SpriteRenderer`/`Collider` as identity passthroughs, `Animator`/`PlayerInput` raw (generics preserved). Unity-style `GetComponent`, stateless proxies re-resolving each access. History appendix records the earlier magic-getters → class-façade (`ScriptComponent<TEngine>`) → alias steps. Roadmap: B2 compiler, B3 `Transform` as pure data via `Changed<T>`.
- `docs/gameplay/exposed-script-variables.md` — **implemented**. Exposing script variables/fields + entity references to the composition root (Unity `[SerializeField]` model): plain-JS `registerScriptMetadata` registry (WeakMap; replaced the old `@Expose`/`Symbol.metadata`/Babel approach), discriminated `ExposeFieldMetadata` (`field`/`entity`) + `ScriptMetadata.field()`/`.entity()` builders, typed `AtlasScript<TProps>` + `attach`/`AttachProps`, stateless `GameEntity` handle (`otherEntity.getComponent`/`.getScript`), warn-never-throw injection. Caveat: `GameEntity` must be `import type` (value import → runtime break under Vite). V2 (rich editor metadata, custom compiler, serialization, optional/array entity fields) → backlog.
- `docs/gameplay/input-scripting.md` — **implemented** (Phases 1 & 2, merged). Phase 1: service access to scripts via high-level façades (generic `ScriptService<TService>` + `InputApi` global keyboard/mouse polling). Phase 2: Unity-style named actions (`defineActions`/`button()`/`vector2()`/`InputActionMap` in `@atlasjs/input`) with ECS integration (`PlayerInput` + `PlayerInputSystem` in `@atlasjs/gameplay`); used in `apps/dino-brawl`. V2 extensions (events, processors, gamepad, rebinding, fixed-lane sampling) → backlog.
- `docs/gameplay/sprite-animation.md` — **implemented**. Sprite animation wired into the gameplay path: `Animator` (LEVEL-1 component, named clips + `play(name)`) + `AnimatorSystem` (dt-driven, pushes the current frame into `SpriteRender.sprite` via the existing swap path, `Map<Frame, Sprite>` cache), reusing nebula `SpriteSheet`/`SpriteAnimation` (the latter made dt-driven). V2 extensions (state machine, frame events, per-frame pivot, one-shot replay) → backlog.
- `docs/gameplay/animation-events.md` — **implemented**. Clip-boundary events on `Animator`: `started`/`finished`/`loop` via `Animator.on`/`off` over core's `EventBus` (payload = clip name). Detection lives **gameplay-side** (edge-detect around `player.tick()` + `play()`) — nebula untouched. Fixed a latent `EventBus.off` typing bug (`EventPayload` double-wrapped in `EventCallback`). V2 (frame events, enriched payload) → backlog.
- `docs/gameplay/entity-hierarchy.md` — **implemented**. Parent/child entity hierarchy + transform composition: generic `Parent`/`Children` relation primitive on `NexusWorld` (`setParent`/`getParent`/`getChildren`, anti-cycle guard, recursive destroy, command-buffer integration), `Mat3` completion (`multiply`/`invert`/decompose), gameplay `WorldTransform2D` + `TransformPropagationSystem` (dynamic body = physics authority, 1-frame physics latency), `Transform` façade `setParent`/`parent`/`getChildren`. V2 (latency-free physics pass, exact shear, subtree dirty-tracking, dynamic composition, typed relations) → backlog.
- `docs/gameplay/camera.md` — **implemented**. Gameplay camera (Nexus entity) driving the nebula render camera, `screenToWorld`/`worldToScreen`, a single active camera switchable via `CameraManager`, `CameraApi` script service. V2 (simultaneous multi-camera render, rotation, per-camera clear/viewport/target, layers/culling mask, formal edit↔play mode, non-ortho projection) → backlog.
- `docs/gameplay/tilemap.md` — **implemented**. `TileSet` asset + `Grid` → N child `TileMap` layers (code-first fill), instanced rendering via a dedicated `TileMapNode` + viewport culling, `sortingOrder` sort. V2 (JSON serialization/`AssetRef`, multi-tileset/rich `Tile`, named sorting layers, tilemap colliders, iso/hex layouts, palette editor, persistent instance buffers, configurable anchor/fit-to-cell) → backlog.
- `docs/gameplay/occluder-ysort.md` — **implemented**. Large-occluder Y-sort: an occluder splits into per-base-line **strips** (Tiled `occluder_regions` rects, `slice: single`/`perRow`), each baked once into a `TileMapNode` on the `Entities` ySorted layer keyed by `footY` so the player interleaves in front of/behind it by foot position. Pure baker (`bakeOccluderStrips`) + `OccluderStrip` LEVEL-1 component + `OccluderRenderSystem` in `@atlasjs/gameplay`; Tiled ingestion in `apps/dino-brawl`. Shares the rectangle seam with future colliders. V2 (zero-entity flyweight, auto-detection, per-strip culling, dynamic occluders) → backlog.
- `docs/gameplay/prefab.md` — **implemented**. Code-first typed prefabs for runtime, script-side entity creation: `definePrefab<TParams>` + `EntityBuilder` (`add`/`attach`), a single `Instantiator` service (token `INSTANTIATOR`) surfaced as `this.instantiate(prefab, params)` with companion `this.destroy()`/`GameEntity.destroy()` (deferred, recursive subtree + script GC via `destroyEntityScripts`). Mono-root, non-serializable, assets captured by closure. V2 (multi-entity prefabs with internal refs, JSON/`PrefabAsset`, pooling) → backlog.

### `docs/assets/`

- `docs/assets/asset-system.md` — **implemented**. Asset system: `Asset` (serializable descriptor) ↔ `Resource` (runtime handle); `AssetManager` (register/load/get/destroy + dedup); plugin-based loaders by type; `TextureAsset`/`TextureLoader` in `@atlasjs/nebula`; `SpriteAsset`/`SpriteLoader` in `@atlasjs/gameplay`. Scene-graph primitives renamed to `*Node` convention. V2 extensions (refcount/eviction, `AssetRef` by id + serialization, audio, editor, non-path sources) → backlog.

### `docs/debug/`

- `docs/debug/gizmos.md` — **implemented**. Debug gizmos: collider outlines + entity-origin discs as opt-in components (`ColliderGizmo`/`PivotGizmo`) plus a global switch, in a standalone `@atlasjs/gizmos` plugin package. Immediate-mode `Gizmos` service over a recycled node pool flushed by a single `gizmos:flush` step; `GIZMO_SORTING_LAYER` draws over everything without knowing the app's named layers. **Reads physics truth**: position/rotation from `PhysicsColliderRef`, extents from `Collider2D.shape` un-scaled, nothing drawn when no collider exists. Added stroke support to nebula shapes (`ShapeNode.borderWidth` → `params.y` → SDF border), closing the renderer backlog "strokes" item. V2 (editor handles, raycast/vector gizmos, `drawLine`, screen-constant thickness, capsule/segment/polygon) → backlog.

---

## Architectural Direction

AtlasJS is intended for a broad audience, from hobby developers to more advanced users and tooling authors.

The public API should remain approachable while preserving enough flexibility for advanced use cases.

The engine core must remain independent from specific implementations whenever possible.

Packages should communicate through stable abstractions, public contracts, and extension points rather than relying directly on internal implementation details.

AtlasJS is currently focused on 2D development, but new architecture should avoid assumptions that would unnecessarily prevent future 3D support.

This does not mean every system must support 3D today. It means new decisions should avoid making future evolution impossible without a strong reason.

---

## AI Agent Guidelines

Before modifying the project:

- Check `docs/` for an existing design document covering the change.
- Identify whether the change belongs in `packages` or `apps`.
- Understand the responsibility of the affected package or application.
- Follow the existing architecture before introducing a new pattern.
- Keep packages loosely coupled.
- Avoid circular dependencies between packages.
- Preserve clear and stable public APIs.
- Avoid leaking implementation details across package boundaries.
- Keep application-specific code out of reusable packages.
- Prefer extending existing systems over creating parallel implementations.
- Keep the engine core independent from optional systems whenever possible.
- Consider runtime performance when introducing new abstractions.
- Preserve the plugin-based philosophy of the engine.
- Avoid introducing unnecessary 2D-only assumptions into foundational APIs.
- Avoid adding comments
- Always type the code, even if the type is trivial. (Function parameters, variables, class params)
- **Rebuild a package's `dist` after changing its public API.** Every package resolves through its `exports` field → `./dist`, so a consumer — a downstream package's type-check, an app's Vite preview — keeps seeing the **old** API until `pnpm --filter <pkg> build` runs. A `PostToolUse` hook covers `.wgsl` edits only; every other public-API change is the operator's responsibility.
- **Import type-only symbols with `import type`** in app and script files (`verbatimModuleSyntax: true`). A value import for a type (`import { GameEntity }`) passes `tsc --noEmit` — the type is erased at type-check time — but **breaks at runtime** under Vite/esbuild: `SyntaxError: … does not provide an export named 'GameEntity'`, black screen. Runtime tokens and values (`NEXUS`, `ASSET_MANAGER`, component classes, `Vec2`) stay normal imports — only the type/value distinction matters. Verify in the browser, not just with `tsc`.
- Avoid circular dependencies

Architecture consistency is generally more important than implementing the quickest possible solution.
Use the skills `clean-code`, `clean-architecture`, `improve-codebase-architecture` and `codebase-design` for designing clean code

When using the `superpowers` plugin skills (e.g. `brainstorming`, `writing-plans`):

- Do **not** commit automatically. Leave changes staged/unstaged for the user to review and commit themselves, unless they explicitly ask for a commit.
- Write design/spec documents directly into `docs/` (flat), not into a nested `docs/superpowers/specs/` folder.
- If the `superpowers` plugin is used and the session started in French, always reply in French for the entire main conversation.

You can use the agent `architect-reviewer` and `code-reviewer` for code review

If a more specific `AGENTS.md` exists inside a package or application, its instructions take precedence over this root document.
