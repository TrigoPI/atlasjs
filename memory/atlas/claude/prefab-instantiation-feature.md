---
name: prefab-instantiation-feature
description: "Prefab/instantiation system shipped (definePrefab + Instantiator + this.instantiate/destroy); the GameEntity.destroy-only leak is now mitigated in-package via a ScriptHost marker"
type: project
modified: 2026-08-08
---

Merged to `dev` (merge dc1f81e, branch feat/claude/prefab, 2026-08-06) — the feature after collisions ([[next-feature-collisions]]). Design: `memory/atlas/gameplay/prefab.md`. In `@atlasjs/gameplay/src/prefab/`.

- **Model**: code-first typed, mono-racine. `definePrefab<TParams>({ name?, build(entity, params) })` returns a pure value (no I/O). `EntityBuilder.add(...)` reuses the `GameEntity.addComponent` dispatch (token→API, raw→instance, you mutate the returned instance); `.attach(Script, props)` = `ScriptManager.attach`. A `Prefab` is captured by an app factory (closure over already-loaded assets) and passed to scripts as an exposed prop via `ScriptMetadata.field` (traverses `injectProps` intact).
- **Runtime API**: `this.instantiate(prefab, params, { parent? })` → `GameEntity`; `this.destroy()` / `GameEntity.destroy()`. Exposed on `AtlasScript` + `ScriptContext`; `RuntimeScriptContext` resolves `INSTANTIATOR` **lazily** via `services.get` (breaks the `ScriptManager ↔ Instantiator` cycle — no ctor injection). `INSTANTIATOR` provided by `GameplayPlugin`.
- **Deferred semantics**: spawned scripts' `onCreate` fires next `flushCreates` (same-frame if spawned inside another `onCreate`; next-frame if inside `onUpdate`). `destroy` is deferred: walks the subtree for script cleanup then `world.commands.destroy` (recursive + existence-guarded at Sync flush). Never destroys mid-`onUpdate` immediately.

**Leak — MITIGATED in-package (gameplay audit, 2026-08-08, commit 5f5dad8, merged to `dev`).** The original gotcha: script records were GC'd **only via `GameEntity.destroy()`**, so a raw `world.destroyEntity`/`commands.destroy` (or a subtree killed by non-script code) leaked records + kept running `onUpdate` on a dead entity. Fix: an empty marker component `ScriptHost` (`components/ScriptHost.ts`) that `ScriptManager.attach` adds to every script-bearing entity; `ScriptManager` self-registers `world.onRemove(ScriptHost, e => destroyEntityScripts(e))` in its ctor (released via `dispose()` from `GameplayPlugin.uninstall`). Now ANY destroy route fires the marker's `onRemove` → `onDestroy` runs exactly once (idempotent `destroyById` absorbs the double-call with `GameEntity.destroy`, which is unchanged). The proper **cross-package** fix (a real `onEntityDestroyed` signal in `NexusWorld`) is still the backlog item (ECS §84) — the marker is a gameplay-side safety net, not the Nexus signal.

Execution followed [[execution-cadence-preference]] (subagent-driven, user committed each task) + [[verify-against-committed-head]]; the `import type` discipline ([[vite-type-only-imports]]) surfaced again in review and was fixed.
