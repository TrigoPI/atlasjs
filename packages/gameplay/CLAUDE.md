# AGENTS.md — @atlasjs/gameplay

The gameplay layer of AtlasJS: a Unity-style **scripting** framework (`AtlasScript` lifecycle + component/service access) and the **engine components + systems** that bridge scripts to the ECS (Nexus), physics (Inertia), rendering (Nebula), and input. This is the package where the other engine packages are **composed** into something a game author writes against.

> Design docs at the repo root — read the relevant one before changing a subsystem:
> - `docs/gameplay/gameplay-redesign.md` — the sync/physics-bridge refactor (single source of truth in Nexus, authority by body type).
> - `docs/gameplay/scripting-components.md` — the Unity-`GetComponent` model for scripts (façades, dispatch).
> - `docs/gameplay/scripting-component-unification.md` — the façade⇔real-behavior rule below and the clean-alias vocabulary come from here.
> - `docs/gameplay/input-scripting.md` — Phase 1: scripts reach services via `getService` + the `InputApi` façade.
> - `docs/gameplay/input-actions.md` — Phase 2: the named-action system (`PlayerInput` + `PlayerInputSystem`).
> - `docs/gameplay/sprite-animation.md` — **implemented**: `Animator` (LEVEL-1 component, named clips + `play(name)`) + `AnimatorSystem` (dt-driven, pushes the current frame into `SpriteRender.sprite`), reusing nebula `SpriteSheet`/`SpriteAnimation`. See `components/Animator.ts`, `systems/AnimatorSystem.ts`.

## The two component levels (do not conflate)

This is the core mental model. Two folders, two meanings:

- **`components/` — engine components (LEVEL 1).** Plain Nexus components **operated on by systems**: `Transform2D`, `RigidBody2D`, `SpriteRender`, `PhysicsBodyRef`, `PlayerInput`. Naming: **no suffix**. A component belongs here if a system queries/mutates it — even if scripts also use it directly (`PlayerInput` is sampled by `PlayerInputSystem`, so it lives here despite being script-facing).
- **`scripting/components/` — scripting-facing tokens (LEVEL 2).** No façade classes here — every script component is minted by `defineScriptComponent(engine, create?)` (`scripting/core/ScriptComponentToken.ts`):
  - **`defineScriptComponent(engine)`** (no `create`) is the **identity** case: it returns the engine `Component` itself, by reference — a passthrough. Generics survive (`PlayerInput<T>` stays `PlayerInput<T>`) because there is no `(world, entity)` ctor to erase them.
  - **`defineScriptComponent(engine, create)`** returns a branded `ScriptComponentToken` (`{ engine, create(world, entity) }`) — a **behavioral token**. `create` mints a stateless proxy exposing a curated API and routing authority.

**Rule: a behavioral token exists only when there is real engine behavior to hide.** After the component-unification cleanup, that is **exactly one** token: `Transform` (`scripting/components/Transform.ts` — `export const Transform = defineScriptComponent(Transform2D, createTransform)`), justified by authority routing (`setPosition` on a dynamic body teleports the physics body, not just the ECS datum), hierarchy (`parent`/`setParent`/`getChildren`), and world-matrix helpers (`worldPosition`). Everything else is a **data-pure** component with nothing to hide, so scripts use it **raw** via the identity case: `RigidBody` (`defineScriptComponent(RigidBody2D)`), `SpriteRenderer` (`defineScriptComponent(SpriteRender)`), `Animator`, `PlayerInput`. Do not add a `create` for symmetry — the old rule ("façade whenever a component is script-facing") produced two unjustified passthrough façades (`RigidBody2DComponent`, `SpriteRendererComponent`, both 100% `this.resolve().x` forwarding) that were removed; see `docs/gameplay/scripting-component-unification.md`.

**Uniform script vocabulary, no `*Component` suffix anywhere.** Scripts always write `this.addComponent(X, …)`, whether `X` resolves to the `Transform` token or a raw component — the suffix that used to mark LEVEL-2 (`Transform2DComponent`, `RigidBody2DComponent`, `SpriteRendererComponent`) is gone. The scripting barrel (`scripting/components/index.ts`) exposes clean names for the data-pure components too, as **identity tokens**: `export const RigidBody = defineScriptComponent(RigidBody2D)` + `export type RigidBody = RigidBody2D`, same for `SpriteRenderer`/`SpriteRender`. `Animator` and `PlayerInput` were already clean and need no alias — they're raw exports straight from `components/`. So a script imports `Transform`, `RigidBody`, `SpriteRenderer`, `Animator`, `PlayerInput` from `@atlasjs/gameplay`; only `Transform` is an actual behavioral token, the rest are the engine components themselves under a curated name — `addComponent(RigidBody)` returns the raw `RigidBody2D` instance, not a proxy.

> Accepted **péremption (staleness) asymmetry**: a raw component reference (`this.rigidbody`, `this.spriteRenderer`) is a live instance that goes stale **silently** if the component is removed and re-added — the field still points at the old object. A `Transform` reference re-resolves the backing component on every access (each getter reads through `world.requireComponent`) and **throws loudly** if it's missing. Invisible under the common pattern (`addComponent` once in `onCreate`, never removed), but real under component churn. Documented and accepted rather than solved — see `scripting-component-unification.md` §1/§7.

> Why `PlayerInput` is not a behavioral token in `scripting/components/`: a `create(world, entity)` proxy **severs** a generic type parameter, so a token over `PlayerInput<T>` would lose the typed `get(name)`. It has no authority to route anyway. So `PlayerInput` is the LEVEL-1 component *and* its own script API — the identity case, unwrapped. This was tried and deliberately reverted.

## Layout

- `scripting/core/` — the script framework (abstract): `AtlasScript` (lifecycle + `getComponent`/`addComponent`/`getService` + `getEntity`), `ScriptContext`, `ScriptComponentToken` (`defineScriptComponent`/`isScriptComponentToken`), `GameEntity` (+ `ScriptResolver` + `createGameEntity`), `ScriptMetadata` (discriminated `ExposeFieldMetadata` union + `field()`/`entity()` builders, merged type+const), `ScriptService` (+ `ScriptServiceCtor`), `ScriptLifeCycle`.
- `scripting/components/` — one LEVEL-2 behavioral token (`Transform`) + two identity tokens (`RigidBody`, `SpriteRenderer`) over LEVEL-1 components.
- `scripting/services/` — service façades: `InputApi` (curated read-only view over the `@atlasjs/input` service; scripts never touch the raw backend).
- `scripting/runtime/` — orchestration: `ScriptManager` (attach/update/destroy scripts), `RuntimeScriptContext`, `IncrementalScriptIdGenerator`.
- `components/` — LEVEL-1 engine components.
- `systems/` — `NexusSystem`s: `PhysicsPushSystem`/`PhysicsPullSystem` (transform↔body sync), `SpriteRenderSystem`, `PlayerInputSystem` (samples every `PlayerInput` at `update`/`Early`).
- `GameplayPlugin.ts` — defines components, registers systems on the scheduler, provides `SCRIPT_MANAGER`. `registerSystem.ts` — the `NexusSystem` → scheduler-step adapter. `tokens.ts` — service tokens.

## Façade & service dispatch (scripting/runtime)

`AtlasScript` routes through `RuntimeScriptContext`:
- `getComponent`/`addComponent`/`requireComponent`/`hasComponent`/`removeComponent` — a single dispatch on `isScriptComponentToken(type)` (a brand check on a well-known symbol, `scripting/core/ScriptComponentToken.ts`): token → operate on `type.engine`, return `type.create(world, entity)` (a fresh stateless proxy); otherwise → raw Nexus component. Only `Transform` takes the token branch today; `RigidBody`/`SpriteRenderer`/`Animator`/`PlayerInput` all take the raw branch — they're plain `Component` values (either the identity result of `defineScriptComponent(engine)` or a straight re-export), so `isScriptComponentToken` is false and they fall through to raw Nexus access.
- `getService(Facade)` — resolves a `ScriptService` façade (declares `static token`) from the engine `ServiceRegistry`, caching the resolved service in the façade ctor (a service is never unprovided). Throws loudly if the service is absent.

**Cross-entity access (`GameEntity`).** A script operates on **other** entities through a `GameEntity` handle — the same `get/add/has/remove/requireComponent` surface as `AtlasScript`, plus **`getScript(ScriptClass)`** (→ the script instance on that entity, `instanceof` match, via `ScriptManager.getScript` which implements the core `ScriptResolver` interface). The token/component dispatch **body lives once** in `GameEntity` (`createGameEntity`/`GameEntityHandle`); `RuntimeScriptContext` delegates its own-entity access to a `self: GameEntity`. Get a handle two ways: (1) **inject another entity as a prop** — declare the field `foo: GameEntity` and mark it `ScriptMetadata.entity({ required })` in `registerScriptMetadata`; the call site passes a **raw `Entity`** (mapped by `AttachProps`), and `injectProps` wraps it into a `GameEntity` (`"field"` kind assigns as-is). (2) **wrap at runtime** — `this.getEntity(entity)`. The handle is **stateless** (holds only `(world, entity, resolver)`, re-resolves each call) — a destroyed entity → `getComponent`/`getScript` return `undefined`. `getComponent` never resolves scripts and `getScript` never resolves components — the two levels stay separate (that's why `getScript` is its own method, not a `getComponent` overload).

## Invariants — do not break

- **Respect the two levels.** New system-driven Nexus data → `components/` (no suffix). New curated proxy hiding real engine behavior → `scripting/components/`, minted via `defineScriptComponent(engine, create)` with a factory — reserve this for genuine authority/hierarchy/derived-state logic, not for giving a component a nicer script-facing name (use the identity case, `defineScriptComponent(engine)`, for that). Don't put non-behavioral tokens in `scripting/components/`.
- **Façades are stateless.** No per-instance state beyond `(world, entity)`; re-resolve via `requireComponent` on each access. A cached datum reintroduces the stale-cache bug the redesign killed.
- **Service façades cache, and never leak the backend.** `getService` returns the façade (e.g. `InputApi`), never the raw service; the façade exposes only a curated surface.
- **Input naming:** `isDown` = held, `isPressed`/`isReleased` = this-frame edges (matches `@atlasjs/input`).
- **Systems own per-frame work; the scheduler is the single ordering authority.** Register via `registerSystem(lane, world, system, { stage })` and keep the `StepHandle` for teardown. Input sampling runs at `update`/`Early` (before scripts at `Logic`); the input backend clears edges at `Late`. **Read input in `onUpdate`, not `onFixedUpdate`** (edges are per-`update`-frame).

## Build & test

`pnpm --filter @atlasjs/gameplay build` (tsdown → `dist`). `pnpm --filter @atlasjs/gameplay test` (vitest; `test/helpers/harness.ts` boots a real `Engine` with stub plugins and exposes `world`/`services`/`scripts`/`frame()`). **Typecheck with `tsc --noEmit`** — never `tsc -b` (it emits artifacts next to sources). When a dependency's public API changes (e.g. `@atlasjs/input`), rebuild its `dist` so this package's typecheck and the sandbox's vite preview resolve it.
