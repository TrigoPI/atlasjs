---
name: debug-gizmos-feature
description: "Debug gizmos (collider outlines + entity-origin discs) shipped to dev 2026-08-19 as @atlasjs/gizmos; exposed and fixed a latent ServiceRegistry bug; packages/editor was deleted as a consequence."
type: project
---

Merged into `dev` on 2026-08-19 (12 commits, branch `feat/claude/debug-gizmos`). Spec and plan:
`memory/atlas/debug/gizmos.md` + `memory/atlas/debug/gizmos-plan.md`.

New package `@atlasjs/gizmos`: an **immediate-mode** `Gizmos` service (`drawRect`/`drawCircle`, a
mutable shared pen) over a pool of recycled nebula nodes, flushed by a single `gizmos:flush` step in
`render`/`PreRender`; producers declare `before: "gizmos:flush"` — that inversion matters, because
`Scheduler.assertSameStage` **throws** if a `before`/`after` names a step absent from the same stage.
Also added stroke to nebula shapes (`ShapeNode.borderWidth` → `params.y` → SDF border), closing the
renderer backlog "strokes" item.

**The design rule worth remembering, because it generalises**: the collider gizmo reads position and
rotation from `PhysicsColliderRef` (rapier truth) and extents from `Collider2D.shape` **un-scaled**,
and draws *nothing* when no physics collider exists. `PhysicsPushSystem.buildColliderDesc` passes
`shape: col.shape` verbatim, so `Transform2D.scale` never reaches a collider — a gizmo that composed
the component with `WorldTransform2D` would draw a plausible lie. Absence of a gizmo is information.

**It paid for itself immediately**: it revealed the sword hitbox offset that had been an untested
hypothesis for a day — see [[weapon-attacks-feature]].

Two consequences beyond the feature:

- **`@atlasjs/core` had a latent blocking bug**: `ServiceRegistry.wait` kept `Map<symbol, Deferred>`
  — one waiter per token — and overwrote it silently, so of two plugins awaiting the same
  not-yet-provided service only the last was ever resolved (`BootTimeoutError` after 10s). `Engine.boot`
  starts all installs **concurrently**, so concurrent waiters are the normal case, not an edge case.
  Fixed (list per token) with a regression test that hangs against the old code. Any second plugin
  declaring an already-awaited `requires` would have hit it.
- **`packages/editor` was deleted** by the owner right after the merge, because the final review
  surfaced that it held a competing, non-compiling gizmo vocabulary (`Gizmo`/`GizmoTool` in lane
  `update` with its own overlay model). Backlog item **B2** ("réconciliation editor ↔ nebula") is
  therefore moot, and several docs still referenced the package as of the merge.

Deferred to backlog: editor handles, `drawLine` + a `LineNode` ring (unblocks raycast/vector/hierarchy
gizmos), screen-constant stroke thickness, exact capsule/segment/polygon, a dedicated overlay pass,
and reading `isSensor()`/`isEnabled()` from the physics handle rather than the component.
