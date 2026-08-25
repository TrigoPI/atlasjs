# AGENTS.md — @atlasjs/core

The engine foundation of AtlasJS: the game loop, the scheduler, the plugin system, service DI, the event bus, and scene management. Everything else (rendering, physics, ECS, gameplay, input, editor) is a **plugin** that composes onto this core. The core is **standalone** — it depends only on `@atlasjs/utils` and knows nothing about any specific renderer, physics engine, or ECS.

> The scheduling/loop design is documented in **`memory/atlas/core/scheduling.md`** at the repo root. Read it before changing the scheduler, the loop, or plugin boot.

## Layout

- `public/engine/` — the public API:
  - `Engine` — owns the loop, boots plugins, holds `services` / `events` / `scheduler` / `scene`.
  - `Scheduler` — the single ordering authority (see below). `SchedulerCycleError`.
  - `Plugin` — abstract base; declares `provides` / `requires` service tokens.
  - `PluginErrors` — `MissingDependencyError`, `DependencyCycleError`, `DuplicateProviderError`, `BootTimeoutError`.
  - `ServiceRegistry` — token-based DI (`provide` / `get` / `wait` / `has`), `ServiceRegistry.createToken<T>()`.
  - `EventBus` — typed pub/sub (`on` / `once` / `emit` / `off`, returns `Unsubscribe`).
  - `Stages` — the stage vocabulary per lane. `Deferred` — a resolvable promise.
- `public/scene/` — `Scene` (abstract), `SceneManager`, `SceneContext`.
- `private/` — `RafLoop` (requestAnimationFrame driver), `FrameClock` (monotonic `tick`/`frame`/`elapsed`/`acc`), `Time` (`clamp`).

## Scheduling model — the heart of the package

**One authority.** The `Scheduler` orders *all* per-frame work. Nothing else schedules (Nexus is a pure data-store; plugins register steps here).

- **Lanes**: `fixed` (simulation, fixed timestep), `update` (variable-rate logic), `render` (presentation).
- **Stages**: each lane has a fixed, ordered, named list of stages (`Stages.ts`) — coarse ordering. E.g. fixed: `PreSim → ScriptFixed → PhysicsRequest → PhysicsStep → PhysicsWriteback → Cleanup → Sync`. Every lane ends with a trailing **`Sync`** stage (anchor 1000): the sync point where cross-cutting barriers run after all other work — e.g. `NexusPlugin` flushes the ECS command buffer here so deferred structural changes apply before the next lane/frame.
- **`before` / `after`**: fine ordering *within a stage* (topological sort). Cross-stage constraints are rejected — use stage order instead.
- Registration: `scheduler.<lane>.add(fn, { name, stage, before?, after?, enabled? }) → StepHandle`. `StepHandle.remove()` / `setEnabled()`. Group with `scheduler.createSet(name)` → `StepSet` (`add` / `enable` / `disable` / `remove`) — used for editor-mode and per-scene steps.
- Every step receives a `StepContext` `{ dt, alpha, tick, frame, elapsed }`, never a bare `dt`. `alpha` is the fixed-step interpolation factor (render lane); `tick` is the rollback anchor.

**Frame order** (`Engine.startLoop`): `fixed (×N, accumulator, capped at maxSubSteps) → update → render`. `advanceFixed(n)` is factored out as the seam a future rollback/netcode driver would call instead of RAF. The loop driver is injectable via `EngineOptions.loop` (used by tests).

## Plugin lifecycle

- A plugin declares `super(id, { provides: [TOKEN…], requires: [TOKEN…] })`.
- `Engine.boot()` topologically orders installs from the dependency graph, then awaits every plugin's `deferred`. It **fails fast** — missing/duplicate provider or a cycle throws before any install; a plugin that never resolves its `deferred` trips `BootTimeoutError` (default 10s, `EngineOptions.bootTimeout`). No silent hangs.
- `install(engine)` may be async and typically: resolves its deps via `engine.services.wait(TOKEN)`, registers steps (keeping the `StepHandle`s), `provide`s its own service, then `this.deferred.resolve()`.
- `uninstall(engine)` **must remove every step it registered** (via the kept handles / a `StepSet`) — the scheduler has no implicit teardown.

## Invariants — do not break

- **Single ordering authority.** Do not add a second scheduler or a parallel "phase runner". New per-frame work is a step in a lane/stage.
- **Core stays standalone.** No dependency on a renderer/physics/ECS package. Cross-package wiring goes through `ServiceRegistry` tokens (defined in the providing package), never direct imports.
- **`install` order is derived, never hand-tuned.** Express ordering through `provides`/`requires`, not a magic number. (`Plugin.order` was removed.)
- **Steps are removable.** Registration returns a `StepHandle`; anything that registers must be able to unregister. No fire-and-forget steps.
- **Stages are a closed enum per lane.** Adding a coarse stage is a deliberate core edit; reach for `before`/`after` first.
- **Keep the fixed lane wall-clock-free.** The simulation must be a pure function of `(tick, fixedDelta, input)` — no `Date.now()`/`performance.now()` in fixed-lane logic — so determinism/rollback stays possible.

## Build & test

`pnpm --filter @atlasjs/core build` (tsdown, ESM + d.ts). `pnpm --filter @atlasjs/core test` (vitest; specs in `test/`). Depends only on `@atlasjs/utils`.
