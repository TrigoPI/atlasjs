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
- `docs/gameplay/scripting-components.md` — **implemented** (phases 1→4). Refines the script component-access API onto a Unity-style `GetComponent` model (`this.x = this.addComponent(Transform2DComponent)`), kills the magic `this.transform`/`this.rigidbody` getters and the façade cache/registry, `ScriptComponent<TEngine>` base with a `static engine` backing + runtime dispatch, stateless façades re-resolving each access.
- `docs/gameplay/input-scripting.md` — **validated, not implemented** (Phase 1 of input scripting). Adds service access to scripts via high-level façades (generic `ScriptService<TService>`), delivers the `InputApi` façade (global keyboard/mouse polling) (→ backlog).
- `docs/gameplay/input-actions.md` — **validated, not implemented** (Phase 2 of input scripting). Unity-style named actions (`jump.isPressed()`, `move.readValue()`) over Phase 1: device-agnostic action engine in `@atlasjs/input`, ECS integration (`PlayerInput` + `PlayerInputSystem`) in `@atlasjs/gameplay` (→ backlog).

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
- Avoid circular dependencies

Architecture consistency is generally more important than implementing the quickest possible solution.
Use the skills `clean-code`, `clean-architecture`, `improve-codebase-architecture` and `codebase-design` for designing clean code

When using the `superpowers` plugin skills (e.g. `brainstorming`, `writing-plans`):

- Do **not** commit automatically. Leave changes staged/unstaged for the user to review and commit themselves, unless they explicitly ask for a commit.
- Write design/spec documents directly into `docs/` (flat), not into a nested `docs/superpowers/specs/` folder.
- If the `superpowers` plugin is used and the session started in French, always reply in French for the entire main conversation.

You can use the agent `architect-reviewer` and `code-reviewer` for code review

If a more specific `AGENTS.md` exists inside a package or application, its instructions take precedence over this root document.
