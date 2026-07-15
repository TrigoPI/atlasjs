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

The `docs` directory contains cross-cutting design documents and architecture decisions that span multiple packages or describe planned refactors.

Consult it before undertaking a significant change: a design may already be validated and awaiting implementation.

Current documents:

- `docs/shaders-materials-redesign.md` — validated redesign of the Nebula shader/material authoring API (WGSL as single source of truth via reflection, layered easy/advanced paths, package split).
- `docs/material-graph-serialization.md` — long-term vision (design only, not implemented): material serialization (load/save) and a node-graph material editor, code-first first with the editor plugging onto the lib. Two tiers (material instance + graph template), graph compiles to WGSL through the existing pipeline.
- `docs/scheduling-redesign.md` — implemented refactor of the engine scheduling/loop: single ordering authority (lanes → named stages → before/after), rollback-ready fixed step (`advanceFixed`, `fixedDelta` drives physics), declared plugin dependencies with topological boot, removable/groupable steps (`StepHandle`/`StepSet`), fixed→update→render loop with interpolation alpha. `scheduler.<lane>.add(fn, spec)` is the registration API. Every lane ends with a trailing `Sync` stage (anchor 1000) — the sync point where cross-cutting barriers like the Nexus command-buffer flush run. See the checklist at the bottom of the doc.
- `docs/nexus-ecs-redesign.md` — implemented refactor + `gameplay` migration of the Nexus ECS: generational entities (safe recycling), swappable `IComponentStore` backend (sparse-set today, SoA/archetype later without touching consumers), typed `world.query(...).each((e, a, b) => …)` with a fail-fast structural-change guard, hybrid command buffer (`world.commands` + `world.flush()`, auto-flushed at the scheduler `Sync` stage by `NexusPlugin`), multi-world via injectable `ComponentRegistry`, query `without`/`optional` filters, and `world.onAdd`/`onRemove` lifecycle events. See the checklist at the bottom of the doc.
- `docs/gameplay-scripting-components.md` — validated (not yet implemented) refinement of the `gameplay` script component-access API: unify all access on a Unity-style `GetComponent` model (`this.x = this.addComponent(Transform2DComponent)`), kill the magic `this.transform`/`this.rigidbody` getters and the façade cache/registry, `ScriptComponent<TEngine>` base with a `static engine` backing + runtime `"engine" in type` dispatch (façade vs raw data component), stateless façades that re-resolve each access. Two component levels (engine `Transform2D` / scripting façade `Transform2DComponent`). Includes a `src/` folder reorg.
- `docs/gameplay-redesign.md` — implemented refactor of `gameplay` scripting/sync (phases 0→6 done): killed the shadow-ECS + diff/request/feedback pipeline (4 copies of one datum) in favor of a **single source of truth** per datum in Nexus, a **thin façade** (Unity-style proxy, not a copy) for the script API (`Transform2DComponent`/`RigidBody2DComponent` via `ScriptComponentRegistry`, lazy resolution + `onRemove`-invalidated cache), a physics bridge with **authority declared by body type** (dynamic → physics, kinematic/static → transform) via `PhysicsPushSystem`/`PhysicsPullSystem`, and runtime body handles (`PhysicsBodyRef`) as Nexus components. Collapsed ~7 sync systems into 2; removed `Vector2D` (use `Vec2`). See the checklist at the bottom of the doc.
- `docs/renderer-architecture-redesign.md` — **implemented** refactor of the Nebula renderer submission path: introduces the missing **render layer** between RHI and scene. Killed the `pipeline` argument of `draw()` (pipeline is an internal cached artifact resolved from `(shader, vertexLayout, RenderState)`; `Material` carries a `RenderState` for blend/depth/cull), added a `DrawCommand` + packed sort key + `RenderQueue`, and a **storage-buffer + instancing** `SpriteBatch` (quad generated in the VS, instance array in `var<storage, read>`, `draw(6, instanceCount)`). Also a `RenderPass`/`RenderTarget` seam (render-to-texture) and 3D-future openings (`Camera` interface, shader library via `getBuiltinShader`). Removed the empty `WebGPUPipelineCache` stub and made `WebGPURenderState` do redundant-bind elimination. All 6 phases done + scene-graph dirty-flag (observable transform) + per-sprite tint/blend. See the checklist at the bottom of the doc.
- `docs/renderer-backlog.md` — **backlog** (not scheduled): candidate follow-up work + debt spotted during the renderer refactor. Shapes/primitives rendering (SceneRenderer only draws `Sprite` today), text rendering, post-processing, custom materials on scene nodes; resource lifetime/eviction, editor↔nebula API drift (editor doesn't compile against current nebula), canvas resize, deferred depth test; plus quick wins (`getWorldPosition` dead code, `ecs.ts` type errors). Suggested order at the bottom.
- `docs/canvas-resize-design.md` — **implemented** design of the canvas resize path (backlog B3). Adds `Renderer.resize(width, height)` in logical (CSS) pixels; `WebGPURenderer` tracks the logical size separately from the physical backing store (`× devicePixelRatio` for crisp HiDPI, camera projects in logical pixels, expand model — a larger canvas reveals more world); auto-observe by default via `ResizeObserver`/`devicePixelContentBoxSize` (opt-out `autoResize`), no context reconfigure (the WebGPU drawing buffer follows `canvas.width/height`), `NebulaRenderer.resize` passthrough. Full-screen render-target resize left out of scope (none exist yet).

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
