---
name: weapon-attacks-feature
description: "Weapon attacks in dino-brawl — declarative AttackTimeline phases + MeleeHitResolver + the cue channel for multi-sound / multi-hit (2026-08-21); timelines must be built lazily."
type: project
modified: 2026-08-21
---

Merged in `dev`. Layering, after the 2026-08-21 cleanup:

- `WeaponAttack` — the contract (`duration`, `sample(t, out)` writing an `AttackPose`) plus the audio and impact fields; `begin()` is a non-abstract default that plays the clip **only if `playsClipOnBegin()` returns true**.
- `TimelineAttack` — one implementation strategy: subclasses only declare `buildPhases(): AttackPhase[]`, and `AttackTimeline` resolves them. `SwingAttack` / `ThrustAttack` / `SpinAttack` are pure declarations now, no `if` cascade over cumulative time.
- `AttackChain` — a *different* strategy (composite delegating to the current combo step), so it extends `WeaponAttack` directly and has no phases. Don't force it onto the timeline.
- `MeleeHitResolver` (`scripts/combat/`) — hit resolution extracted out of `SwordScript`: owns the per-swing `struck` set and the reusable `HitInfo`, depends on a structural `MeleeTargetSource { getTargets() }` so it has **no** dependency on `weapon/` and is unit-testable without an ECS. Enemy weapons only need to satisfy that shape.

**The non-obvious constraint: exposed script props are injected AFTER construction.** So anything derived from them (the timeline, the resolver) must be built **lazily on first use and memoized** — never in the constructor, and not in `onCreate` either for anything the specs reach, because the test rigs can't call `onCreate` (it needs a bound `ScriptContext`, otherwise `"Script context is not bound"`). Both `TimelineAttack.getTimeline()` and `SwordScript.getResolver()` follow that pattern.

`AttackTimeline` semantics that make the declarations short: a channel no phase mentions is written with its identity (`angleOffset` 0, `radiusScale` 1, `scale` 1); a tween with no `from` starts where the previous phase left that channel; a phase mentioning **no** channel holds everything constant (that's how the thrust's `hold` works). `sample` is pure — same `t` always gives the same pose, which is what makes the hitstop freeze drift-free.

**Hit detection is fixed.** The two old suspects are gone: hits are now resolved **every frame** of the attack (not at one `impactTime` instant — that field no longer exists), and the blade sensor carries `offset(20, -20)` + `rotation π/4` in `SwordWithShadowPrefab`, tuned with the gizmos of [[debug-gizmos-feature]].

**Hitstop is no longer globally inert.** `SwordScript.hitstopDuration` still defaults to 0 and `spawnPlayer` still never passes it, so the *weapon-level* value stays inert — but an attack can now override it, and `rappierSwordCombo` gives `LungeAttack` `hitstop: 0.12` and `knockback: 2200`. So the finisher does freeze and does hit harder; the two quick links still don't.

Still open: the `Vec2.angle` convention. `packages/math/test/vec2-angle.test.ts` is **committed and red — 2 failures** (verified 2026-08-21): it demands `[0, 2PI[` normalization while `SwordSortingScript` depends on the signed `atan2`, so greening it by "fixing" the implementation silently kills its behind-the-player branch. Consequence to know: `pnpm --filter @atlasjs/math test` is never green, so don't read that as damage from your own change.

Two framework gaps found along the way, both still true: exposed-field inheritance works at runtime (`getScriptMetadata` merges along the prototype chain) but **not** at the type level (`AttachProps<PropsOf<T>>` only sees the leaf's `TProps`; cleanest fix is `extends AtlasScript<TProps & SharedProps>` in the base). And `drainCollisions` swallows `Stopped` events when a collider is destroyed, so `onTriggerExit` never fires for a destroyed entity — worked around app-side in `SwordHitboxScript` by storing `GameEntity` handles and pruning dead targets.


## The cue channel (shipped 2026-08-21, branch `feat/weapon-attack-cues`)

`AttackPhase` carries `cue?: { sound?: { clip?, pitch?, volume? }, rearmHits?: boolean }` — **one** event channel with two consumers, which is what makes multi-sound and multi-hit the same feature rather than two mechanisms.

- `AttackTimeline` stays pure: cues come out of an explicit range query `collectCues(fromT, toT, out)`, low bound **exclusive**, high **inclusive**, appending to a caller-owned array. `sample()` gained no side effect.
- `TimelineAttack` is the emitter: `advance(t)` fires the crossed cues, `rearmsHits` reports the last call. Its cursor is **monotonic** — a `t` at or below it is ignored and never rewinds it. Without that, a regressing clock replays cues (double SFX, double hit). Only `begin()` rewinds, seeding `-1` so a phase starting at `t = 0` fires on the first `advance(dt)`.
- **"The timeline wins":** declare one sound cue and `begin()` stops auto-playing, so the first cue isn't doubled. `defaultSwordCombo` declares none and is byte-for-byte unchanged in behaviour.
- `SwordScript` re-arms `MeleeHitResolver.beginSwing()` when `rearmsHits` is true, **before** the frame's `resolve()`. And `startAttack()` must call `attack.begin()` *before* arming, because `AttackChain.begin()` is what picks the current link.
- `MeleeHitResolver.beginSwing(knockback?, hitstop?)` falls back **per field with `??`**, so an explicit `0` is honoured; the constructor values are the weapon-level defaults.
- `rearmsHits` is a boolean, not a counter: several rearm cues in one frame = one hit. At collapsed framerate a burst that jumps phases lands one hit while all its sounds still play. Assumed, not a bug.

Measured in game (60 fps, temporary `console.log` in `fireCue`): `ThrustChainAttack` → 3 cues at pitch 2.50 / 2.62 / 2.74, all `rearm=true`; `LungeAttack` → 1 cue at 1.60, `rearm=false`.

Full design + caveats: `docs/gameplay/weapon-attack-cues.md` §9. Backlog opened: APP-05 (per-attack shake), APP-06 (richer cues), APP-07 (props validation), GAMEPLAY-60 (promote to a package).
