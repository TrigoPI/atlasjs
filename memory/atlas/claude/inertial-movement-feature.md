---
name: inertial-movement-feature
description: "Inertial velocity-driven movement for bump-royal: dynamic body + script-written velocity — merged into dev on 2026-09-01, not pushed; the two apps now diverge on movement architecture on purpose."
type: project
modified: 2026-09-01
---

On 2026-09-01, shipped **inertial movement for `apps/bump-royal`**: a `dynamic` rapier body whose
**velocity is written by the script** every fixed step, contacts left to the solver. Branch
`feat/claude/inertial-movement`, **5 commits `a818707` → `5d698b3`**, plus the two commits before them
(`29630e7`, `c4953ee`) carrying the user's own pending changes (superpowers plugin dropped, the
bump-royal sandbox app itself). **Merged into `dev` on 2026-09-01 (fast-forward, so the commits stand on their own). NOT pushed.**

Design note: [[velocity-ownership]] — it teaches the fork (who owns the velocity × who owns the
contacts), not just the outcome. Read it before touching either app's movement.

What landed, bottom-up: `Vec2.moveTowards`/`Vec2.lerp` (`@atlasjs/math`) · `onFixedUpdate(dt)`
(`@atlasjs/gameplay`) · `lockRotation` across contract/backend/double/component/bridge · zero world
gravity + the movement model in the app.

**Gotchas worth remembering:**

- **rapier's `lockRotations` does not cancel an existing angular velocity.** It zeroes the inverse
  inertia, so it prevents angvel from being *created* — a body already spinning at angvel 2 kept
  turning indefinitely after the call. Both the desc path (`map-rigid-body-desc.ts`) and the setter
  (`RapierRigidBody.setRotationLocked`) must `setAngvel(0)`, or one flag means two different things.
- **`PhysicsPushSystem` wrote `setAngularVelocity` unconditionally every frame**, which **re-armed a
  locked body** while `isRotationLocked()` answered `true`. Now skipped under the lock. Generalise
  the suspicion: **a flag the bridge can silently undo is worth looking for elsewhere** — the push
  system writes several properties every single frame.
- **`RigidBody2D.mass` IS authoritative while `Collider2D.density` is 0, which is the default.**
  Measured `base 0 → setMass(5) → 5`; at density 1 it is **additive** (`0.080 → 5.080`), not inert
  as [[PHYSICS-22-rigidbody-mass-semantics]] claimed. The likely cause of the older, harsher reading
  is **a missing `step()` before reading the mass** — rapier had not recomposed its mass properties
  yet. Corrected in that note by `13a4641`. Practical upshot: weight classes are reachable today.
- **`onFixedUpdate` now takes a `dt`** — the raw `fixedDelta`, **unscaled**: no global time scale
  (already applied to the accumulator, so it changes how *often* the lane runs), no per-entity
  `TimeScale`, and **timers still advance on the `update` lane only**. Pinned by
  `packages/gameplay/test/script-fixed-dt.test.ts`. Stage `ScriptFixed` (150) runs before
  `PhysicsRequest` (200), so a velocity written there reaches the body in the same step.
- **The bump-royal preview pane drops to 4 fps.** Judge a movement feature **qualitatively** there
  and measure it on **accumulated fixed time**, never on wall clock: the glide is provable, the
  tuning (0.5 s / 1 s / 150 units) is not. See [[sandbox-browser-verify-gotchas]].
- ~~**`apps/bump-royal` has no test infrastructure at all**~~ — **fixed 2026-09-06**
  (see [[state-sync]]): the app now has vitest and 149 specs, the overspeed branch included. The
  engine-side twin is still open — [[GAMEPLAY-112-script-harness-cannot-drive-fixed-lane]], the
  published unit seam cannot drive `onFixedUpdate` — which is why those specs drive a real `Engine`.

**The two apps now diverge on movement architecture, on purpose.** dino-brawl stays kinematic +
`CharacterController2D` with `Transform2D` as the authority ([[world-collisions-character-controller]]);
bump-royal is dynamic with a script-written velocity. **Do not "unify" them** — the engine carries
both and does not pick. Corollary: [[GAMEPLAY-64-movement-arbitration]] is largely dissolved for
bump-royal's model (scripts steer a shared velocity instead of each adding a displacement) and still
fully open for dino-brawl's.
