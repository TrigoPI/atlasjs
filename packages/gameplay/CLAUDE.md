# AGENTS.md — @atlasjs/gameplay

The gameplay layer of AtlasJS: a Unity-style **scripting** framework (`AtlasScript` lifecycle + component/service access) and the **engine components + systems** that bridge scripts to the ECS (Nexus), physics (Inertia), rendering (Nebula), and input. This is the package where the other engine packages are **composed** into something a game author writes against.

> Design docs at the repo root — read the relevant one before changing a subsystem:
> - `docs/gameplay-redesign.md` — the sync/physics-bridge refactor (single source of truth in Nexus, authority by body type).
> - `docs/gameplay-scripting-components.md` — the Unity-`GetComponent` model for scripts (façades, dispatch). **The taxonomy below comes from here.**
> - `docs/gameplay-input-scripting.md` — Phase 1: scripts reach services via `getService` + the `InputApi` façade.
> - `docs/gameplay-input-actions.md` — Phase 2: the named-action system (`PlayerInput` + `PlayerInputSystem`).

## The two component levels (do not conflate)

This is the core mental model. Two folders, two meanings:

- **`components/` — engine components (LEVEL 1).** Plain Nexus components **operated on by systems**: `Transform2D`, `RigidBody2D`, `SpriteRender`, `PhysicsBodyRef`, `PlayerInput`. Naming: **no suffix**. A component belongs here if a system queries/mutates it — even if scripts also use it directly (`PlayerInput` is sampled by `PlayerInputSystem`, so it lives here despite being script-facing).
- **`scripting/components/` — scripting façades (LEVEL 2).** `ScriptComponent<TEngine>` subclasses only: stateless `(world, entity)` proxies with a `static engine` backing, exposing a curated API and routing authority. Naming: **`*Component` suffix** (`Transform2DComponent`, `RigidBody2DComponent`, `SpriteRendererComponent`). A façade exists **only** when there's engine-internal behavior to hide (e.g. `Transform2DComponent.setPosition` routes to the physics body). If a component has nothing to hide, it stays LEVEL 1 and scripts use it raw — **do not** wrap it in a façade for symmetry.

> Why `PlayerInput` is not `PlayerInputComponent` in `scripting/components/`: a `ScriptComponent` façade's `(world, entity)` ctor **severs** a generic type parameter, so a façade over `PlayerInput<T>` would lose the typed `get(name)`. It has no authority to route anyway. So `PlayerInput` is the LEVEL-1 component *and* its own script API. This was tried and deliberately reverted.

## Layout

- `scripting/core/` — the script framework (abstract): `AtlasScript` (lifecycle + `getComponent`/`addComponent`/`getService`), `ScriptContext`, `ScriptComponent` (+ `ScriptComponentCtor`), `ScriptService` (+ `ScriptServiceCtor`), `ScriptLifeCycle`.
- `scripting/components/` — LEVEL-2 façades (mirror of `components/`).
- `scripting/services/` — service façades: `InputApi` (curated read-only view over the `@atlasjs/input` service; scripts never touch the raw backend).
- `scripting/runtime/` — orchestration: `ScriptManager` (attach/update/destroy scripts), `RuntimeScriptContext`, `IncrementalScriptIdGenerator`.
- `components/` — LEVEL-1 engine components.
- `systems/` — `NexusSystem`s: `PhysicsPushSystem`/`PhysicsPullSystem` (transform↔body sync), `SpriteRenderSystem`, `PlayerInputSystem` (samples every `PlayerInput` at `update`/`Early`).
- `GameplayPlugin.ts` — defines components, registers systems on the scheduler, provides `SCRIPT_MANAGER`. `registerSystem.ts` — the `NexusSystem` → scheduler-step adapter. `tokens.ts` — service tokens.

## Façade & service dispatch (scripting/runtime)

`AtlasScript` routes through `RuntimeScriptContext`:
- `getComponent`/`addComponent`/`requireComponent`/`hasComponent`/`removeComponent` — dispatch on `prototype instanceof ScriptComponent`: façade → operate on `type.engine`, return a fresh stateless proxy; otherwise → raw Nexus component.
- `getService(Facade)` — resolves a `ScriptService` façade (declares `static token`) from the engine `ServiceRegistry`, caching the resolved service in the façade ctor (a service is never unprovided). Throws loudly if the service is absent.

## Invariants — do not break

- **Respect the two levels.** New system-driven Nexus data → `components/` (no suffix). New curated proxy hiding engine behavior → `scripting/components/` (`*Component`, extends `ScriptComponent`, `static engine`). Don't put non-façades in `scripting/components/`.
- **Façades are stateless.** No per-instance state beyond `(world, entity)`; re-resolve via `requireComponent` on each access. A cached datum reintroduces the stale-cache bug the redesign killed.
- **Service façades cache, and never leak the backend.** `getService` returns the façade (e.g. `InputApi`), never the raw service; the façade exposes only a curated surface.
- **Input naming:** `isDown` = held, `isPressed`/`isReleased` = this-frame edges (matches `@atlasjs/input`).
- **Systems own per-frame work; the scheduler is the single ordering authority.** Register via `registerSystem(lane, world, system, { stage })` and keep the `StepHandle` for teardown. Input sampling runs at `update`/`Early` (before scripts at `Logic`); the input backend clears edges at `Late`. **Read input in `onUpdate`, not `onFixedUpdate`** (edges are per-`update`-frame).

## Build & test

`pnpm --filter @atlasjs/gameplay build` (tsdown → `dist`). `pnpm --filter @atlasjs/gameplay test` (vitest; `test/helpers/harness.ts` boots a real `Engine` with stub plugins and exposes `world`/`services`/`scripts`/`frame()`). **Typecheck with `tsc --noEmit`** — never `tsc -b` (it emits artifacts next to sources). When a dependency's public API changes (e.g. `@atlasjs/input`), rebuild its `dist` so this package's typecheck and the sandbox's vite preview resolve it.
