---
name: world-collisions-character-controller
description: "World solidity via rapier KinematicCharacterController — implemented, browser-verified, and MERGED into dev (confirmed 2026-08-19); the feature branch no longer exists."
type: project
modified: 2026-08-05
---

On 2026-08-05, implemented **world solidity via rapier's `KinematicCharacterController`** (collide-and-slide) — the Phase-3 follow-up flagged in [[next-feature-collisions]] and [[occluder-ysort-feature]]. **Status: MERGED into `dev`.** Implemented on `feat/claude/tilemap-collision` (10 commits off `dev` `c405808` → `0cd5a0b`), browser-verified, final opus whole-branch review = merge-ready (0 Critical/Important). Left unmerged at the time, but **confirmed merged on 2026-08-19**: the branch no longer exists, `packages/gameplay/src/components/CharacterController2D.ts` is in the tree, and `git branch --contains` on its introducing commit lists `dev`.

Design docs: `docs/physics/character-controller.md` (+ `-plan.md`). Stack, bottom-up:
- **inertia**: `CharacterController` contract (`computeMovement(collider, desired) → correctedDelta`) + `PhysicsWorld.createCharacterController/destroyCharacterController`. (Replaced a dead platformer `CharacterController` helper.)
- **rapier**: `RapierCharacterController` wraps `KinematicCharacterController`; `offset` passed raw (meters, NOT converted), `desired`/`computedMovement` unit-converted; `filterGroups` = player collider's own interaction groups; `setSlideEnabled(true)`.
- **gameplay**: LEVEL-1 `CharacterController2D` (config) + `CharacterControllerRef` (handle, minted by `PhysicsPushSystem`, torn down in `GameplayPlugin` via the mirrored collider-pair onRemove hooks) + LEVEL-2 behavioral token `CharacterController.move(delta)` (stateless, writes `Transform2D` — correct because player is kinematic).
- **app (dino-brawl)**: `ingestColliders` reads a Tiled `colliders` objectgroup → static box `Collider2D` entities on a NEW `World` collision layer; player collider is a box at the feet via `Collider2D.offset`; `PlayerMovementScript` calls `move()`.

**Gotchas learned (non-obvious):**
- Rapier kinematic bodies are **never auto-blocked** by geometry (position- vs velocity-based makes no difference); the character controller is the only way. Player body = `kinematicPositionBased`.
- Collide-and-slide keeps the player from **overlapping** World colliders → `onCollisionEnter` does **NOT** fire against them (events ≠ solidity; Phase-1 events stay orthogonal).
- Put the collider at the feet with **`Collider2D.offset`**, NOT the sprite pivot (pivot drives render + Y-sort). Sprite image padding below the feet made pivot `(0.5,1)` sit too low.
- The `occluder_regions` rects are too big/dense as colliders → author **tight rects on a separate `colliders` layer** (decoupled solidity vs occlusion — that's why the layer is separate).
- Browser-verify caveats: WebGPU sandbox ~4fps amplifies the large per-frame move step; vite port conflicts from stray servers — kill strays, align vite+harness on 5173. See [[sandbox-browser-verify-gotchas]].

**Follow-ups:** pre-existing UNRELATED red on `dev` — `@atlasjs/input` wasd test is stale (asserts `(0,1)` for W; impl returns `(0,-1)`, correct Y-down) → flagged as a background task, not on this branch. Deferred (backlog): 2 cosmetic rapier minors (`assertRapierCharacterController` helper + guard wording); token has no kinematic-body guard (misuse footgun); a leftover `[collision]` `console.log` in `PlayerMovementScript` (user chose to keep).

**How to apply:** the feature is in `dev` — build on it, do not re-implement. `docs/physics/character-controller.md` still declared "conçu, non implémenté" until the docs reorganisation fixed it; treat any status line in that doc family as suspect until checked against the code. SDD ledger at `.superpowers/sdd/character-controller-plan/progress.md`. Repo execution style: [[execution-cadence-preference]] (subagent-driven, user commits each step), [[verify-against-committed-head]], [[run-prettier-before-staging]], [[vite-type-only-imports]].
