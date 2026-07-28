# Collision Layer — Repair & Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make colliders actually work end-to-end — a `Collider2D` on an entity produces a real, layer-filtered collision with Unity-style callbacks on scripts — by repairing the broken physics abstraction and wiring the collision half that was never connected.

**Architecture:** `@atlasjs/inertia` owns the backend-agnostic contract (collider filtering as packed membership/filter numbers, named-layer helper, collision-event drain, `userData`); `@atlasjs/rapier` implements it correctly on rapier2d-compat; `@atlasjs/gameplay` bridges it to the ECS via a `Collider2D` component, a collider-creation pass in `PhysicsPushSystem`, and a `PhysicsCollisionSystem` that dispatches `onCollisionEnter/Exit` + `onTriggerEnter/Exit` to scripts. Contact→entity mapping rides on `Collider.userData` holding the `Entity`.

**Tech Stack:** TypeScript, pnpm/Turborepo monorepo, `@dimforge/rapier2d-compat@0.19.3`, Nexus ECS, Vitest, tsdown.

## Global Constraints

Copied verbatim from the project conventions — every task's requirements implicitly include this section:

- **No comments in code.** Semantics live in this doc, not in inline comments.
- **Type everything**, even trivially (function params, variables, class fields).
- **No circular dependencies** between packages. Dependency direction stays `rapier → inertia`, `gameplay → inertia`; `inertia` never imports `rapier` or `gameplay`.
- **Typecheck with `tsc --noEmit`** — never `tsc -b` (it emits artifacts next to sources). `gameplay` typecheck is `pnpm --filter @atlasjs/gameplay typecheck`.
- **Rebuild a dependency's `dist` after changing its public API** so downstream typecheck and the sandbox's Vite preview resolve it: `pnpm --filter @atlasjs/inertia build`, then `pnpm --filter @atlasjs/rapier build`.
- **In app/script files (`apps/sandbox`), import type-only symbols with `import type`** (e.g. `GameEntity`) — a value import typechecks but breaks the Vite runtime (black screen).
- **Do NOT commit automatically.** Each task ends green and is handed off for the user to review and commit. The "Hand off" step is the user's checkpoint, not an agent `git commit`.
- **Two component levels (gameplay):** system-driven Nexus data → `components/` (no suffix, e.g. `Collider2D`). Curated script names → `scripting/components/` as identity tokens (`defineScriptComponent(engine)`) unless there is real behavior to hide. `Collider2D` is data-pure → identity token alias `Collider`, no factory.

---

## Implementation Progress

Executed sub-agent-driven (fresh implementer + reviewer per task; the user commits each task). Updated as tasks land.

| Task | Status | Commit |
|---|---|---|
| 1 — CollisionLayers primitive (`inertia`) | ✅ done | `11e5bd5` |
| 2 — Extend collision contract + backend stubs | ✅ done | `0fbd73a` |
| 3 — `packCollisionGroups` helper (`rapier`) | ✅ done | `0b07d20` |
| 4 — Fix filtering on `RapierCollider` | ✅ done | `be563c0` |
| 5 — Apply groups + active events in `mapColliderDesc` | ✅ done | `190bd82` |
| 6 — `RapierPhysicsWorld` event queue + collider cleanup | ✅ done | pending commit |
| 7 — `RapierPhysicsQuery` unit-aware raycast + overlaps | ✅ done | pending commit |
| 8 — `Collider2D` component + `Collider` alias + exports | 🔨 in progress | — |
| 9 — `PhysicsColliderRef` component | ⏳ pending | — |
| 10 — Extend `FakePhysicsWorld` (test infra) | ⏳ pending | — |
| 11 — Collider-creation pass in `PhysicsPushSystem` | ⏳ pending | — |
| 12 — Collision lifecycle callbacks on scripts | ⏳ pending | — |
| 13 — `PhysicsCollisionSystem` dispatch | ⏳ pending | — |
| 14 — Sandbox demo + browser-verify | ⏳ pending | — |

---

## Context (why this plan exists)

An audit of `@atlasjs/inertia` + `@atlasjs/rapier` found the rigid-body path is sound but the **collision half is a skeleton that was never wired or exercised**, with three latent bugs sitting exactly on the path of the next feature (world solidity):

1. **Filtering is wrong.** `RapierCollider.setCollisionMask` routes to `setSolverGroups` (a different axis than detection filtering), and `mapColliderDesc` never applies `collisionGroup`/`collisionMask`/`userData` at all — so layer filtering does nothing.
2. **Raycast ignores unit conversion** — wrong by a factor of `unitsPerMeter` (100 in the sandbox); `intersectPoint`/`intersectAABB` are silent `[]` stubs.
3. **No collision events, no `Collider.userData`, no gameplay `Collider2D`** — bodies exist but nothing collides, and nothing can map a contact back to an `Entity`.

Design decisions locked in brainstorming: **named layers per collider** (numbers under the hood, names via a helper), **Unity-style script callbacks** for events, `Collider2D` without a body = **static world geometry**, events **on by default** on bridge colliders, `defineCollisionLayers` lives in **`inertia`**.

**Out of scope** (deferred): sleeping/dirty-flag & the sync-by-intention command buffer (perf), compound/merged tilemap colliders (world-solidity feature), joints. A separate **Phase 0 hygiene cleanup** (remove dead `CharacterController`, fix `ensure-rapier-init`, drop unused deps, `dispose()`/`world.free()`, rename `RapierPhyicsQuery` file, trim barrels) is **not** in this plan; this plan only absorbs the strictly-necessary fixes (collider leak on body destroy, dead `converter` field on `RapierCollider`).

**Known Phase 1 limitations** (documented, accepted): body-less (static) colliders are placed at creation and do not follow a moving `Transform2D`; removing `RigidBody2D` while keeping `Collider2D` leaves a stale `PhysicsColliderRef` (remove/re-add `Collider2D` to recreate); kinematic bodies detect collisions (events fire) but are not physically blocked (solid response for a script-driven player is a future character-controller concern) — the demo proves detection + filtering, not blocking.

---

## File Structure

**`@atlasjs/inertia`** (contract)
- Create `packages/inertia/src/CollisionLayers.ts` — `defineCollisionLayers`, `CollisionLayer`, `CollisionMask`, `ALL_LAYERS`, `NO_LAYERS`.
- Modify `packages/inertia/src/Collider.ts` — add `getUserData`/`setUserData`.
- Modify `packages/inertia/src/inertial-type.ts` — `ColliderDesc.events`, new `CollisionHandler`.
- Modify `packages/inertia/src/PhysicsWorld.ts` — add `drainCollisions`.
- Modify `packages/inertia/src/index.ts` — export `CollisionLayers`.
- Create `packages/inertia/vitest.config.ts` + `packages/inertia/test/collision-layers.test.ts`.

**`@atlasjs/rapier`** (backend)
- Create `packages/rapier/src/mappers/collision-groups.ts` — pure `packCollisionGroups`.
- Modify `packages/rapier/src/RapierCollider.ts` — filtering fix, `userData`, drop dead converter.
- Modify `packages/rapier/src/rapier-types.ts` — `RapierColliderOption`: drop `unitScale`, add `userData`.
- Modify `packages/rapier/src/mappers/map-collider-desc.ts` — apply packed groups + active events.
- Modify `packages/rapier/src/RapierPhysicsWorld.ts` — `EventQueue`, `drainCollisions`, `createCollider` userData, `destroyRigidBody` collider cleanup, guarded `destroyCollider`, pass converter to query.
- Modify `packages/rapier/src/RapierPhyicsQuery.ts` — unit-aware raycast + real `intersectPoint`/`intersectAABB`.
- Create `packages/rapier/vitest.config.ts` + `packages/rapier/test/collision-groups.test.ts`.

**`@atlasjs/gameplay`** (bridge)
- Create `packages/gameplay/src/components/Collider2D.ts`.
- Create `packages/gameplay/src/components/PhysicsColliderRef.ts`.
- Modify `packages/gameplay/src/components/index.ts` — export both.
- Modify `packages/gameplay/src/scripting/components/index.ts` — `Collider` identity alias.
- Modify `packages/gameplay/src/scripting/core/ScriptLifeCycle.ts` + `AtlasScript.ts` — 4 collision callbacks.
- Create `packages/gameplay/src/systems/PhysicsCollisionSystem.ts`.
- Modify `packages/gameplay/src/systems/PhysicsPushSystem.ts` — collider-creation pass.
- Modify `packages/gameplay/src/systems/index.ts` — export the new system.
- Modify `packages/gameplay/src/GameplayPlugin.ts` — define components, `onRemove` hooks, register system.
- Modify `packages/gameplay/src/index.ts` — re-export layer helpers + shape descs.
- Modify `packages/gameplay/test/helpers/fake-physics.ts` — `FakeCollider`, collider support, `drainCollisions`, `emitCollision`.
- Create `packages/gameplay/test/collision-bridge.test.ts`.

**`apps/sandbox`** (demo)
- Modify `apps/sandbox/src/game/EcsScene.ts` — layers + colliders on trees & player.
- Modify `apps/sandbox/src/game/scripts/PlayerMovementScript.ts` — `onCollisionEnter` logging.

---

# Phase 1 — Extend the contract (`inertia`) & keep every package green

Adding members to `PhysicsWorld`/`Collider` forces `RapierPhysicsWorld`/`RapierCollider` and the test `FakePhysicsWorld` to implement them or the workspace stops building. Phase 1 therefore introduces the contract **and** minimal implementations/stubs in the same tasks; Phase 2 makes the rapier behavior correct.

### Task 1: Named collision layers (`inertia`, pure, TDD)

**Files:**
- Create: `packages/inertia/src/CollisionLayers.ts`
- Create: `packages/inertia/vitest.config.ts`
- Create: `packages/inertia/test/collision-layers.test.ts`
- Modify: `packages/inertia/package.json` (add `test` script)
- Modify: `packages/inertia/src/index.ts`

**Interfaces:**
- Produces: `defineCollisionLayers<const K extends string>(...names: K[]): CollisionLayers<K>`; `type CollisionLayer = number`; `type CollisionMask = number`; `const ALL_LAYERS: CollisionMask = 0xffff`; `const NO_LAYERS: CollisionMask = 0x0000`.

- [ ] **Step 1: Add the vitest config**

Create `packages/inertia/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Add the `test` script**

In `packages/inertia/package.json`, add to `"scripts"` (after `"clean"`):

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing test**

Create `packages/inertia/test/collision-layers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { defineCollisionLayers } from "../src/CollisionLayers";

describe("defineCollisionLayers", () => {
  it("assigns one distinct bit per layer, in order", () => {
    const layers = defineCollisionLayers("Player", "Wall", "Enemy");
    expect(layers.Player).toBe(1);
    expect(layers.Wall).toBe(2);
    expect(layers.Enemy).toBe(4);
  });

  it("layers combine with bitwise OR into a mask", () => {
    const layers = defineCollisionLayers("A", "B", "C");
    expect(layers.A | layers.C).toBe(5);
  });

  it("throws beyond 16 layers", () => {
    const names = Array.from({ length: 17 }, (_, i) => `L${i}`);
    expect(() => defineCollisionLayers(...names)).toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/inertia test`
Expected: FAIL — cannot resolve `../src/CollisionLayers`.

- [ ] **Step 5: Implement `CollisionLayers.ts`**

Create `packages/inertia/src/CollisionLayers.ts`:

```ts
export type CollisionLayer = number;
export type CollisionMask = number;

export const ALL_LAYERS: CollisionMask = 0xffff;
export const NO_LAYERS: CollisionMask = 0x0000;

export type CollisionLayers<K extends string> = {
  readonly [P in K]: CollisionLayer;
};

export function defineCollisionLayers<const K extends string>(
  ...names: K[]
): CollisionLayers<K> {
  if (names.length > 16) {
    throw new Error(
      `defineCollisionLayers supports at most 16 layers, received ${names.length}.`,
    );
  }

  const layers: Record<string, CollisionLayer> = {};

  for (let i = 0; i < names.length; i++) {
    layers[names[i]] = 1 << i;
  }

  return layers as CollisionLayers<K>;
}
```

- [ ] **Step 6: Export it**

In `packages/inertia/src/index.ts`, add:

```ts
export * from "./CollisionLayers";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/inertia test`
Expected: PASS (3 tests).

- [ ] **Step 8: Hand off** — build (`pnpm --filter @atlasjs/inertia build`), confirm green, hand off for user review & commit. Suggested message: `feat(inertia): add defineCollisionLayers primitive`.

---

### Task 2: Extend the collision contract + keep implementors compiling

**Files:**
- Modify: `packages/inertia/src/Collider.ts`
- Modify: `packages/inertia/src/inertial-type.ts`
- Modify: `packages/inertia/src/PhysicsWorld.ts`
- Modify: `packages/rapier/src/RapierCollider.ts:6-21` (add `userData` field + accessors)
- Modify: `packages/rapier/src/rapier-types.ts` (add `userData` to `RapierColliderOption`)
- Modify: `packages/rapier/src/RapierPhysicsWorld.ts` (add `drainCollisions` stub, pass `userData` in `createCollider`)
- Modify: `packages/gameplay/test/helpers/fake-physics.ts` (add `drainCollisions` stub)

**Interfaces:**
- Produces: `Collider.getUserData<T>(): T | undefined`, `Collider.setUserData(data: unknown): this`; `ColliderDesc.events?: boolean`; `type CollisionHandler = (a: Collider, b: Collider, started: boolean) => void`; `PhysicsWorld.drainCollisions(handler: CollisionHandler): void`.

- [ ] **Step 1: Add `userData` to the `Collider` interface**

In `packages/inertia/src/Collider.ts`, add after `getDensity(): number;` (line 21):

```ts
  getUserData<T = unknown>(): T | undefined;
```

and after `setEnabled(value: boolean): this;` (line 15):

```ts
  setUserData(data: unknown): this;
```

- [ ] **Step 2: Add `events` + `CollisionHandler` to `inertial-type.ts`**

In `packages/inertia/src/inertial-type.ts`, add `events` to `ColliderDesc` (after `enabled?: boolean;`, line 36):

```ts
  events?: boolean;
```

and add at the end of the file:

```ts
export type CollisionHandler = (
  a: Collider,
  b: Collider,
  started: boolean,
) => void;
```

- [ ] **Step 3: Add `drainCollisions` to `PhysicsWorld`**

In `packages/inertia/src/PhysicsWorld.ts`, import the type and add the method. Change the import line 2:

```ts
import { RigidBodyDesc, ColliderDesc, CollisionHandler } from "./inertial-type";
```

Add after `step(dt: number): void;` (line 9):

```ts
  drainCollisions(handler: CollisionHandler): void;
```

- [ ] **Step 4: Build `inertia` so downstream sees the new API**

Run: `pnpm --filter @atlasjs/inertia build`
Expected: builds; `rapier` and `gameplay` will now fail typecheck until updated below.

- [ ] **Step 5: Implement `userData` on `RapierCollider`, drop the dead converter**

In `packages/rapier/src/RapierCollider.ts`, replace lines 1-21 (imports + fields + constructor) with:

```ts
import RAPIER from "@dimforge/rapier2d-compat";
import { Collider, RigidBody } from "@atlasjs/inertia";
import { RapierColliderOption } from "./rapier-types";

export class RapierCollider implements Collider {
  public readonly id: string;
  public readonly rapierCollider: RAPIER.Collider;

  private readonly body: RigidBody | null;
  private userData: unknown;

  public constructor(
    rapierCollider: RAPIER.Collider,
    options: RapierColliderOption,
  ) {
    this.body = options.body;
    this.id = options.id;
    this.rapierCollider = rapierCollider;
    this.userData = options.userData;
  }
```

Then add the two accessors before `getRigidBody()` (currently line 86):

```ts
  public getUserData<T = unknown>(): T | undefined {
    return this.userData as T | undefined;
  }

  public setUserData(data: unknown): this {
    this.userData = data;
    return this;
  }
```

- [ ] **Step 6: Update `RapierColliderOption`**

In `packages/rapier/src/rapier-types.ts`, replace the `RapierColliderOption` type (lines 12-16):

```ts
export type RapierColliderOption = {
  id: string;
  body: RigidBody | null;
  userData?: unknown;
};
```

- [ ] **Step 7: Pass `userData` in `createCollider` + add `drainCollisions` stub**

In `packages/rapier/src/RapierPhysicsWorld.ts`, in `createCollider` replace lines 100-123 (the body) with:

```ts
  public createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider {
    const colDesc: RAPIER.ColliderDesc = mapColliderDesc(
      descriptor,
      this.converter,
    );

    let rawCollider: RAPIER.Collider;
    let parentBody: RigidBody | null = null;

    if (body) {
      this.assertRapierBody(body);
      rawCollider = this.world.createCollider(colDesc, body.rapierBody);
      parentBody = body;
    } else {
      rawCollider = this.world.createCollider(colDesc);
    }

    const id: string = String(rawCollider.handle);
    const wrapper: RapierCollider = new RapierCollider(rawCollider, {
      id,
      body: parentBody,
      userData: descriptor.userData,
    });
```

Add the import at the top (with the other `@atlasjs/inertia` imports, lines 13-22):

```ts
  CollisionHandler,
```

Add a stub method after `step` (after line 63) — real implementation lands in Task 6:

```ts
  public drainCollisions(_handler: CollisionHandler): void {}
```

- [ ] **Step 8: Add the `drainCollisions` stub to the test fake**

In `packages/gameplay/test/helpers/fake-physics.ts`, extend the `@atlasjs/inertia` import (lines 3-11) with `CollisionHandler`:

```ts
  CollisionHandler,
```

and add to `FakePhysicsWorld` after `step` (after line 167):

```ts
  public drainCollisions(_handler: CollisionHandler): void {}
```

- [ ] **Step 9: Verify all three packages typecheck/build/test**

Run: `pnpm --filter @atlasjs/rapier build`
Expected: PASS.
Run: `pnpm --filter @atlasjs/gameplay typecheck && pnpm --filter @atlasjs/gameplay test`
Expected: PASS (existing suites still green).

- [ ] **Step 10: Hand off** — confirm green, hand off for review & commit. Suggested: `feat(inertia): add collider userData + collision-event drain to the physics contract`.

---

# Phase 2 — Correct backend behavior (`rapier`)

Rapier's WASM behavior is not unit-tested here (no WASM test harness exists — a follow-up); the pure packing helper **is** unit-tested, and the real filtering/events/queries are validated by build + the Phase 4 sandbox browser-verify.

### Task 3: `packCollisionGroups` pure helper (`rapier`, TDD)

**Files:**
- Create: `packages/rapier/src/mappers/collision-groups.ts`
- Create: `packages/rapier/vitest.config.ts`
- Create: `packages/rapier/test/collision-groups.test.ts`
- Modify: `packages/rapier/package.json` (add `test` script)

**Interfaces:**
- Produces: `packCollisionGroups(membership: number, filter: number): number` — packs membership into the high 16 bits, filter into the low 16, as an unsigned 32-bit value.

- [ ] **Step 1: Add vitest config + test script**

Create `packages/rapier/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

In `packages/rapier/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `packages/rapier/test/collision-groups.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { packCollisionGroups } from "../src/mappers/collision-groups";

describe("packCollisionGroups", () => {
  it("packs membership into the high 16 bits and filter into the low 16", () => {
    expect(packCollisionGroups(0x0001, 0x0002)).toBe(0x00010002);
  });

  it("packs all-ones as an unsigned 32-bit value", () => {
    expect(packCollisionGroups(0xffff, 0xffff)).toBe(0xffffffff);
  });

  it("masks inputs to 16 bits", () => {
    expect(packCollisionGroups(0x1ffff, 0x1ffff)).toBe(0xffffffff);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/rapier test`
Expected: FAIL — cannot resolve `../src/mappers/collision-groups`.

- [ ] **Step 4: Implement the helper**

Create `packages/rapier/src/mappers/collision-groups.ts`:

```ts
export function packCollisionGroups(
  membership: number,
  filter: number,
): number {
  return (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/rapier test`
Expected: PASS (3 tests).

- [ ] **Step 6: Hand off** — Suggested: `feat(rapier): add packCollisionGroups helper`.

---

### Task 4: Fix collision filtering on `RapierCollider`

**Files:**
- Modify: `packages/rapier/src/RapierCollider.ts` (setters/getters lines 36-72)

**Interfaces:**
- Consumes: `packCollisionGroups` (Task 3).
- Produces: `RapierCollider` where `getCollisionGroup()` returns membership (high 16 bits) and `getCollisionMask()` returns filter (low 16 bits), both writing through a single `setCollisionGroups`.

- [ ] **Step 1: Import the helper**

In `packages/rapier/src/RapierCollider.ts`, add after the existing imports:

```ts
import { packCollisionGroups } from "./mappers/collision-groups";
```

- [ ] **Step 2: Replace the four group/mask methods**

Replace `setCollisionGroup` (lines 36-39), `setCollisionMask` (46-49), `getCollisionGroup` (66-68), `getCollisionMask` (70-72) with:

```ts
  public setCollisionGroup(group: number): this {
    const filter: number = this.rapierCollider.collisionGroups() & 0xffff;
    this.rapierCollider.setCollisionGroups(packCollisionGroups(group, filter));
    return this;
  }

  public setCollisionMask(mask: number): this {
    const membership: number =
      (this.rapierCollider.collisionGroups() >>> 16) & 0xffff;
    this.rapierCollider.setCollisionGroups(
      packCollisionGroups(membership, mask),
    );
    return this;
  }

  public getCollisionGroup(): number {
    return (this.rapierCollider.collisionGroups() >>> 16) & 0xffff;
  }

  public getCollisionMask(): number {
    return this.rapierCollider.collisionGroups() & 0xffff;
  }
```

(Leave `setSensor`, `setRestitution`, `setFriction`, `setDensity`, `setEnabled` unchanged. `setSolverGroups` is no longer referenced.)

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @atlasjs/rapier build`
Expected: PASS. Grep to confirm the misuse is gone:
`grep -n "setSolverGroups\|solverGroups" packages/rapier/src/RapierCollider.ts` → no matches.

- [ ] **Step 4: Hand off** — Suggested: `fix(rapier): map collision membership/filter to a single collisionGroups value`.

---

### Task 5: Apply groups + active events in `mapColliderDesc`

**Files:**
- Modify: `packages/rapier/src/mappers/map-collider-desc.ts:91-157`

**Interfaces:**
- Consumes: `packCollisionGroups` (Task 3); `ColliderDesc.collisionGroup/collisionMask/events` (inertia).
- Produces: a `RAPIER.ColliderDesc` with `collisionGroups` set when either group/mask is provided, and `ActiveEvents.COLLISION_EVENTS` set when `events === true`.

- [ ] **Step 1: Import the helper**

In `packages/rapier/src/mappers/map-collider-desc.ts`, add after the existing imports:

```ts
import { packCollisionGroups } from "./collision-groups";
```

- [ ] **Step 2: Apply groups + events before returning**

In `mapColliderDesc`, insert before `return collider;` (currently line 156):

```ts
  if (
    descCpy.collisionGroup !== undefined ||
    descCpy.collisionMask !== undefined
  ) {
    const membership: number = descCpy.collisionGroup ?? 0xffff;
    const filter: number = descCpy.collisionMask ?? 0xffff;
    collider.setCollisionGroups(packCollisionGroups(membership, filter));
  }

  if (descCpy.events === true) {
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  }
```

(`RAPIER` is already imported at the top of the file.)

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @atlasjs/rapier build`
Expected: PASS.

- [ ] **Step 4: Hand off** — Suggested: `fix(rapier): apply collision groups + active events at collider creation`.

---

### Task 6: `RapierPhysicsWorld` — event queue, drain, collider cleanup

**Files:**
- Modify: `packages/rapier/src/RapierPhysicsWorld.ts`

**Interfaces:**
- Consumes: `CollisionHandler` (inertia), `RAPIER.EventQueue`.
- Produces: real `drainCollisions`; `step` that feeds the event queue; `destroyRigidBody` that removes attached colliders from the JS map; guarded `destroyCollider`; the query constructed with the unit converter (consumed by Task 7).

- [ ] **Step 1: Add the event-queue field + init it**

In `packages/rapier/src/RapierPhysicsWorld.ts`, add after `private world!: RAPIER.World;` (line 33):

```ts
  private eventQueue!: RAPIER.EventQueue;
```

In `init()`, after `this.world = new RAPIER.World(gravity);` (line 52), add:

```ts
    this.eventQueue = new RAPIER.EventQueue(true);
```

- [ ] **Step 2: Feed the queue in `step` + implement `drainCollisions`**

Replace `step` (lines 60-63) with:

```ts
  public step(dt: number): void {
    this.world.timestep = dt;
    this.world.step(this.eventQueue);
  }

  public drainCollisions(handler: CollisionHandler): void {
    this.eventQueue.drainCollisionEvents(
      (h1: number, h2: number, started: boolean) => {
        const a: RapierCollider | undefined = this.colliders.get(h1);
        const b: RapierCollider | undefined = this.colliders.get(h2);

        if (a === undefined || b === undefined) {
          return;
        }

        handler(a, b, started);
      },
    );
  }
```

(Delete the `drainCollisions` stub added in Task 2 Step 7.)

- [ ] **Step 3: Clean up colliders on body destroy**

Replace `destroyRigidBody` (lines 94-98) with:

```ts
  public destroyRigidBody(body: RigidBody): void {
    this.assertRapierBody(body);
    const rb: RAPIER.RigidBody = body.rapierBody;
    const count: number = rb.numColliders();

    for (let i = 0; i < count; i++) {
      this.colliders.delete(rb.collider(i).handle);
    }

    this.bodies.delete(rb.handle);
    this.world.removeRigidBody(rb);
  }
```

- [ ] **Step 4: Make `destroyCollider` idempotent (order-independent teardown)**

Replace `destroyCollider` (lines 129-133) with:

```ts
  public destroyCollider(collider: Collider): void {
    this.assertRapierCollider(collider);
    const handle: number = collider.rapierCollider.handle;

    if (!this.colliders.has(handle)) {
      return;
    }

    this.colliders.delete(handle);
    this.world.removeCollider(collider.rapierCollider, true);
  }
```

- [ ] **Step 5: Pass the converter to the query**

Replace the `RapierPhysicsQuery` construction in `init()` (lines 53-57) with:

```ts
    this.queryApi = new RapierPhysicsQuery(
      this.world,
      this.converter,
      (handle: number) => this.colliders.get(handle) ?? null,
      (handle: number) => this.bodies.get(handle) ?? null,
    );
```

- [ ] **Step 6: Verify build**

Run: `pnpm --filter @atlasjs/rapier build`
Expected: build fails at the `RapierPhysicsQuery` constructor arity — that is fixed in Task 7. If you are running tasks in order, proceed to Task 7 before re-building. (Standalone check: `grep -n "new RAPIER.EventQueue\|drainCollisionEvents\|numColliders" packages/rapier/src/RapierPhysicsWorld.ts` → 3 matches.)

- [ ] **Step 7: Hand off** — after Task 7 makes the package build, hand off Tasks 6+7 together. Suggested: `feat(rapier): event-queue drain + leak-free collider teardown`.

---

### Task 7: `RapierPhysicsQuery` — unit-aware raycast + real overlap queries

**Files:**
- Modify: `packages/rapier/src/RapierPhyicsQuery.ts`

**Interfaces:**
- Consumes: `PhysicsUnitConverter` (constructor arg 2, added by Task 6 Step 5).
- Produces: `raycast` in world units (`origin`/`maxDistance` converted in, `toi` converted out); `intersectPoint`/`intersectAABB` returning resolved `Collider[]`. Note: `raycast` expects `direction` to be a **normalized (unit) vector** so `toi` is a world-space distance.

- [ ] **Step 1: Rewrite the query class**

Replace the entire contents of `packages/rapier/src/RapierPhyicsQuery.ts` with:

```ts
import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { ColliderResolver, RigidBodyResolver } from "./rapier-types";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";

import {
  AABB,
  Collider,
  PhysicsQuery,
  RaycastHit,
  RigidBody,
} from "@atlasjs/inertia";

export class RapierPhysicsQuery implements PhysicsQuery {
  private readonly world: RAPIER.World;
  private readonly converter: PhysicsUnitConverter;
  private readonly resolveCollider: ColliderResolver;
  private readonly resolveBody: RigidBodyResolver;

  public constructor(
    world: RAPIER.World,
    converter: PhysicsUnitConverter,
    resolveCollider: ColliderResolver,
    resolveBody: RigidBodyResolver,
  ) {
    this.world = world;
    this.converter = converter;
    this.resolveCollider = resolveCollider;
    this.resolveBody = resolveBody;
  }

  public raycast(
    origin: Vec2,
    direction: Vec2,
    maxDistance: number,
  ): RaycastHit | null {
    const ray: RAPIER.Ray = new RAPIER.Ray(
      {
        x: this.converter.toPhysics(origin.x),
        y: this.converter.toPhysics(origin.y),
      },
      { x: direction.x, y: direction.y },
    );

    const maxToi: number = this.converter.toPhysics(maxDistance);

    const hit: RAPIER.RayColliderIntersection | null =
      this.world.castRayAndGetNormal(ray, maxToi, true);

    if (!hit) {
      return null;
    }

    const collider: Collider | null = this.resolveCollider(hit.collider.handle);

    if (!collider) {
      return null;
    }

    const parent: RAPIER.RigidBody | null = hit.collider.parent();

    const body: RigidBody | null =
      parent != null ? this.resolveBody(parent.handle) : null;

    return {
      collider,
      body,
      normal: new Vec2(hit.normal.x, hit.normal.y),
      toi: this.converter.toWorld(hit.timeOfImpact),
    };
  }

  public intersectPoint(point: Vec2): Collider[] {
    const result: Collider[] = [];

    const target: RAPIER.Vector = {
      x: this.converter.toPhysics(point.x),
      y: this.converter.toPhysics(point.y),
    };

    this.world.intersectionsWithPoint(target, (found: RAPIER.Collider) => {
      const collider: Collider | null = this.resolveCollider(found.handle);
      if (collider) {
        result.push(collider);
      }
      return true;
    });

    return result;
  }

  public intersectAABB(bounds: AABB): Collider[] {
    const result: Collider[] = [];

    const minX: number = this.converter.toPhysics(bounds.min.x);
    const minY: number = this.converter.toPhysics(bounds.min.y);
    const maxX: number = this.converter.toPhysics(bounds.max.x);
    const maxY: number = this.converter.toPhysics(bounds.max.y);

    const shape: RAPIER.Cuboid = new RAPIER.Cuboid(
      (maxX - minX) / 2,
      (maxY - minY) / 2,
    );

    const center: RAPIER.Vector = {
      x: (maxX + minX) / 2,
      y: (maxY + minY) / 2,
    };

    this.world.intersectionsWithShape(
      center,
      0,
      shape,
      (found: RAPIER.Collider) => {
        const collider: Collider | null = this.resolveCollider(found.handle);
        if (collider) {
          result.push(collider);
        }
        return true;
      },
    );

    return result;
  }
}
```

- [ ] **Step 2: Verify build (rapier now compiles fully)**

Run: `pnpm --filter @atlasjs/rapier build`
Expected: PASS. If `RAPIER.Cuboid` or a query signature mismatches the installed `@dimforge/rapier2d-compat@0.19.3`, consult `node_modules/.pnpm/@dimforge+rapier2d-compat@0.19.3/node_modules/@dimforge/rapier2d-compat/pipeline/world.d.ts` and `geometry/` for the exact names and adjust.

- [ ] **Step 3: Hand off** — Suggested (with Task 6): `feat(rapier): unit-aware raycast + real point/AABB overlap queries`.

---

# Phase 3 — Wire the collision layer into gameplay

### Task 8: `Collider2D` component + `Collider` script alias + exports

**Files:**
- Create: `packages/gameplay/src/components/Collider2D.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Modify: `packages/gameplay/src/index.ts`

**Interfaces:**
- Produces: `class Collider2D` (fields: `shape: ColliderShapeDesc`, `offset: Vec2`, `rotation: number`, `isSensor: boolean`, `layer: number`, `collidesWith: number`, `friction: number`, `restitution: number`, `density: number`; constructor `(shape: ColliderShapeDesc)`); script alias `Collider` (identity token) + `type Collider = Collider2D`; re-exported `defineCollisionLayers`, `ALL_LAYERS`, `NO_LAYERS`, and shape-desc types from `@atlasjs/gameplay`.

- [ ] **Step 1: Create the component**

Create `packages/gameplay/src/components/Collider2D.ts`:

```ts
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS, ColliderShapeDesc } from "@atlasjs/inertia";

export class Collider2D {
  public shape: ColliderShapeDesc;
  public offset: Vec2;
  public rotation: number;
  public isSensor: boolean;
  public layer: number;
  public collidesWith: number;
  public friction: number;
  public restitution: number;
  public density: number;

  public constructor(shape: ColliderShapeDesc) {
    this.shape = shape;
    this.offset = new Vec2(0, 0);
    this.rotation = 0;
    this.isSensor = false;
    this.layer = ALL_LAYERS;
    this.collidesWith = ALL_LAYERS;
    this.friction = 0.5;
    this.restitution = 0;
    this.density = 0;
  }
}
```

- [ ] **Step 2: Export from the component barrel**

In `packages/gameplay/src/components/index.ts`, add (keep alphabetical-ish order, after `./Camera`):

```ts
export * from "./Collider2D";
```

- [ ] **Step 3: Add the `Collider` script alias**

In `packages/gameplay/src/scripting/components/index.ts`, change the first import to include `Collider2D` and add the alias:

```ts
import { Collider2D, RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const Collider = defineScriptComponent(Collider2D);
export type Collider = Collider2D;

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;

export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
```

- [ ] **Step 4: Re-export layer helpers + shape descs from gameplay**

In `packages/gameplay/src/index.ts`, add after the `export { Color } ...` line (line 2):

```ts
export { defineCollisionLayers, ALL_LAYERS, NO_LAYERS } from "@atlasjs/inertia";

export type {
  CollisionLayer,
  CollisionMask,
  CollisionLayers,
  ColliderShapeDesc,
  BoxColliderShapeDesc,
  CircleColliderShapeDesc,
  CapsuleColliderShapeDesc,
} from "@atlasjs/inertia";
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @atlasjs/inertia build && pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS.

- [ ] **Step 6: Hand off** — Suggested: `feat(gameplay): add Collider2D component + Collider script alias`.

---

### Task 9: `PhysicsColliderRef` component

**Files:**
- Create: `packages/gameplay/src/components/PhysicsColliderRef.ts`
- Modify: `packages/gameplay/src/components/index.ts`

**Interfaces:**
- Produces: `class PhysicsColliderRef { collider: Collider; constructor(collider: Collider) }`.

- [ ] **Step 1: Create the component**

Create `packages/gameplay/src/components/PhysicsColliderRef.ts`:

```ts
import { Collider } from "@atlasjs/inertia";

export class PhysicsColliderRef {
  public collider: Collider;

  public constructor(collider: Collider) {
    this.collider = collider;
  }
}
```

- [ ] **Step 2: Export it**

In `packages/gameplay/src/components/index.ts`, add after `./PhysicsBodyRef`:

```ts
export * from "./PhysicsColliderRef";
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS.

- [ ] **Step 4: Hand off** — Suggested: `feat(gameplay): add PhysicsColliderRef component`.

---

### Task 10: Extend `FakePhysicsWorld` with collider + event support (test infra)

**Files:**
- Modify: `packages/gameplay/test/helpers/fake-physics.ts`

**Interfaces:**
- Produces: `class FakeCollider implements Collider`; `FakePhysicsWorld.colliders: Set<FakeCollider>`, `colliderCount`, real `createCollider`/`destroyCollider`/`drainCollisions`, and a test helper `emitCollision(a: Collider, b: Collider, started: boolean): void`.

- [ ] **Step 1: Add `FakeCollider`**

In `packages/gameplay/test/helpers/fake-physics.ts`, add after the `FakeRigidBody` class (after line 142):

```ts
export class FakeCollider implements Collider {
  public readonly id: string;

  private sensor: boolean;
  private enabled: boolean;
  private group: number;
  private mask: number;
  private friction: number;
  private restitution: number;
  private density: number;
  private userData: unknown;
  private readonly body: RigidBody | null;

  public constructor(
    id: string,
    descriptor: ColliderDesc,
    body: RigidBody | null,
  ) {
    this.id = id;
    this.sensor = descriptor.sensor ?? false;
    this.enabled = descriptor.enabled ?? true;
    this.group = descriptor.collisionGroup ?? 0xffff;
    this.mask = descriptor.collisionMask ?? 0xffff;
    this.friction = descriptor.friction ?? 0;
    this.restitution = descriptor.restitution ?? 0;
    this.density = descriptor.density ?? 0;
    this.userData = descriptor.userData;
    this.body = body;
  }

  public isSensor(): boolean {
    return this.sensor;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setSensor(value: boolean): this {
    this.sensor = value;
    return this;
  }

  public setCollisionGroup(group: number): this {
    this.group = group;
    return this;
  }

  public setRestitution(value: number): this {
    this.restitution = value;
    return this;
  }

  public setCollisionMask(mask: number): this {
    this.mask = mask;
    return this;
  }

  public setFriction(value: number): this {
    this.friction = value;
    return this;
  }

  public setDensity(value: number): this {
    this.density = value;
    return this;
  }

  public setEnabled(value: boolean): this {
    this.enabled = value;
    return this;
  }

  public getCollisionGroup(): number {
    return this.group;
  }

  public getCollisionMask(): number {
    return this.mask;
  }

  public getRestitution(): number {
    return this.restitution;
  }

  public getFriction(): number {
    return this.friction;
  }

  public getDensity(): number {
    return this.density;
  }

  public getUserData<T = unknown>(): T | undefined {
    return this.userData as T | undefined;
  }

  public setUserData(data: unknown): this {
    this.userData = data;
    return this;
  }

  public getRigidBody(): RigidBody | null {
    return this.body;
  }
}
```

- [ ] **Step 2: Add collider state + events to `FakePhysicsWorld`**

Replace the `FakePhysicsWorld` fields + constructor (lines 145-156) with:

```ts
export class FakePhysicsWorld implements PhysicsWorld {
  public readonly bodies: Set<FakeRigidBody>;
  public readonly colliders: Set<FakeCollider>;
  public stepCount: number;

  private readonly gravity: Vec2;
  private readonly events: Array<{
    a: FakeCollider;
    b: FakeCollider;
    started: boolean;
  }>;
  private nextId: number;

  public constructor() {
    this.bodies = new Set();
    this.colliders = new Set();
    this.stepCount = 0;
    this.gravity = new Vec2(0, 0);
    this.events = [];
    this.nextId = 0;
  }

  public get bodyCount(): number {
    return this.bodies.size;
  }

  public get colliderCount(): number {
    return this.colliders.size;
  }
```

- [ ] **Step 3: Implement collider methods + drain + emit; clear events**

Replace `createCollider`/`destroyCollider` (lines 190-194) with:

```ts
  public createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider {
    const collider: FakeCollider = new FakeCollider(
      `fake-collider-${this.nextId++}`,
      descriptor,
      body ?? null,
    );
    this.colliders.add(collider);
    return collider;
  }

  public destroyCollider(collider: Collider): void {
    this.colliders.delete(collider as FakeCollider);
  }
```

Replace the `drainCollisions` stub (added in Task 2 Step 8) with:

```ts
  public drainCollisions(handler: CollisionHandler): void {
    for (const event of this.events) {
      handler(event.a, event.b, event.started);
    }
    this.events.length = 0;
  }

  public emitCollision(a: Collider, b: Collider, started: boolean): void {
    this.events.push({
      a: a as FakeCollider,
      b: b as FakeCollider,
      started,
    });
  }
```

Replace `clear` (lines 200-203) with:

```ts
  public clear(): void {
    this.bodies.clear();
    this.colliders.clear();
    this.events.length = 0;
    this.stepCount = 0;
  }
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (existing suites; the fake now supports colliders).

- [ ] **Step 5: Hand off** — Suggested: `test(gameplay): FakePhysicsWorld collider + collision-event support`.

---

### Task 11: Collider-creation pass in `PhysicsPushSystem` + plugin wiring (TDD)

**Files:**
- Modify: `packages/gameplay/src/systems/PhysicsPushSystem.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Create: `packages/gameplay/test/collision-bridge.test.ts`

**Interfaces:**
- Consumes: `Collider2D`, `PhysicsColliderRef`, `PhysicsBodyRef`, `Transform2D`; `PhysicsWorld.createCollider`.
- Produces: a `PhysicsColliderRef` on every `Collider2D` entity; the collider's `userData` is the `Entity`; cleanup on `Collider2D`/`PhysicsColliderRef` removal and entity destroy.

- [ ] **Step 1: Write the failing lifecycle test**

Create `packages/gameplay/test/collision-bridge.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColliderShapeDesc } from "@atlasjs/inertia";
import { Entity } from "@atlasjs/nexus";

import { Collider2D, RigidBody2D, Transform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

const BOX: ColliderShapeDesc = { type: "box", width: 10, height: 10 };

describe("Gameplay — collision bridge", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("creates exactly one collider per Collider2D entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);
  });

  it("tags the collider userData with the owning entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getUserData<Entity>()).toBe(e);
  });

  it("attaches the collider to the body when RigidBody2D is present", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, RigidBody2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    const collider = [...h.physics.colliders][0];
    expect(collider.getRigidBody()).not.toBeNull();
  });

  it("destroys the collider when Collider2D is removed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.removeComponent(e, Collider2D);
    expect(h.physics.colliderCount).toBe(0);
  });

  it("destroys the collider when the entity is destroyed", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.world.addComponent(e, Collider2D, BOX);

    h.frame();
    expect(h.physics.colliderCount).toBe(1);

    h.world.destroyEntity(e);
    expect(h.physics.colliderCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- collision-bridge`
Expected: FAIL — colliders are never created (`colliderCount` is 0).

- [ ] **Step 3: Add the collider-creation pass to `PhysicsPushSystem`**

In `packages/gameplay/src/systems/PhysicsPushSystem.ts`, update imports:

```ts
import { Collider, ColliderDesc, PhysicsWorld, RigidBody } from "@atlasjs/inertia";
```

```ts
import {
  Collider2D,
  PhysicsBodyRef,
  PhysicsColliderRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../components";
```

Add a field + init it in the constructor:

```ts
  private readonly pendingColliders: Entity[];
```

```ts
    this.pendingColliders = [];
```

At the end of `update`, after `this.pending.length = 0;`-based body work and the existing second query (after line 71), add:

```ts
    world.query(Collider2D).without(PhysicsColliderRef).each((entity) => {
      this.pendingColliders.push(entity);
    });

    for (const entity of this.pendingColliders) {
      const col: Collider2D = world.requireComponent(entity, Collider2D);
      const bodyRef: PhysicsBodyRef | undefined = world.getComponent(entity, PhysicsBodyRef);
      const transform: Transform2D | undefined = world.getComponent(entity, Transform2D);
      const desc: ColliderDesc = this.buildColliderDesc(world, entity, col, bodyRef, transform);
      const collider: Collider = this.inertia.createCollider(desc, bodyRef?.body);
      world.addComponent(entity, PhysicsColliderRef, collider);
    }

    this.pendingColliders.length = 0;
```

Add the helper method (after `resolvePlacement`):

```ts
  // prettier-ignore
  private buildColliderDesc(
    world: NexusWorld,
    entity: Entity,
    col: Collider2D,
    bodyRef: PhysicsBodyRef | undefined,
    transform: Transform2D | undefined,
  ): ColliderDesc {
    let tx: number = col.offset.x;
    let ty: number = col.offset.y;
    let rot: number = col.rotation;

    if (bodyRef === undefined && transform !== undefined) {
      const place: ResolvedPlacement = this.resolvePlacement(world, entity, transform);
      tx = place.x + col.offset.x;
      ty = place.y + col.offset.y;
      rot = place.rotation + col.rotation;
    }

    return {
      shape: col.shape,
      translation: new Vec2(tx, ty),
      rotation: rot,
      sensor: col.isSensor,
      friction: col.friction,
      restitution: col.restitution,
      density: col.density,
      collisionGroup: col.layer,
      collisionMask: col.collidesWith,
      events: true,
      userData: entity,
    };
  }
```

- [ ] **Step 4: Define components + register cleanup hooks in the plugin**

In `packages/gameplay/src/GameplayPlugin.ts`, add `Collider2D` and `PhysicsColliderRef` to the component imports (lines 27-39) and to the `defineComponent` chain (lines 81-92):

```ts
      .defineComponent(Collider2D)
      .defineComponent(PhysicsColliderRef)
```

Add the two `onRemove` hooks inside the `this.unsubscribers.push(...)` block (alongside the existing ones):

```ts
      world.onRemove(PhysicsColliderRef, (_entity: Entity, ref: PhysicsColliderRef) => {
        inertia.destroyCollider(ref.collider);
      }),

      world.onRemove(Collider2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsColliderRef)) {
          world.removeComponent(entity, PhysicsColliderRef);
        }
      }),
```

- [ ] **Step 5: Run the lifecycle tests**

Run: `pnpm --filter @atlasjs/gameplay test -- collision-bridge`
Expected: PASS (5 tests). Run the full suite too: `pnpm --filter @atlasjs/gameplay test` → all green.

- [ ] **Step 6: Hand off** — Suggested: `feat(gameplay): create + tear down colliders from Collider2D`.

---

### Task 12: Collision lifecycle callbacks on scripts

**Files:**
- Modify: `packages/gameplay/src/scripting/core/ScriptLifeCycle.ts`
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts:19-22`

**Interfaces:**
- Produces: optional `onCollisionEnter(other: GameEntity)`, `onCollisionExit(other)`, `onTriggerEnter(other)`, `onTriggerExit(other)` on `ScriptLifecycle` and `AtlasScript`.

- [ ] **Step 1: Extend `ScriptLifecycle`**

Replace the contents of `packages/gameplay/src/scripting/core/ScriptLifeCycle.ts` with:

```ts
import type { GameEntity } from "./GameEntity";

export interface ScriptLifecycle {
  onCreate?(): void;
  onUpdate?(dt: number): void;
  onFixedUpdate?(): void;
  onDestroy?(): void;
  onCollisionEnter?(other: GameEntity): void;
  onCollisionExit?(other: GameEntity): void;
  onTriggerEnter?(other: GameEntity): void;
  onTriggerExit?(other: GameEntity): void;
}
```

- [ ] **Step 2: Declare them on `AtlasScript`**

In `packages/gameplay/src/scripting/core/AtlasScript.ts`, after `public onDestroy?(): void;` (line 22), add:

```ts
  public onCollisionEnter?(other: GameEntity): void;
  public onCollisionExit?(other: GameEntity): void;
  public onTriggerEnter?(other: GameEntity): void;
  public onTriggerExit?(other: GameEntity): void;
```

(`GameEntity` is already imported as a type in `AtlasScript.ts`.)

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS.

- [ ] **Step 4: Hand off** — Suggested: `feat(gameplay): add collision/trigger lifecycle hooks to scripts`.

---

### Task 13: `PhysicsCollisionSystem` — dispatch events to scripts (TDD)

**Files:**
- Create: `packages/gameplay/src/systems/PhysicsCollisionSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Modify: `packages/gameplay/test/collision-bridge.test.ts` (append dispatch tests)

**Interfaces:**
- Consumes: `PhysicsWorld.drainCollisions`, `Collider.getUserData/isSensor`, `ScriptManager.getScriptsByEntity`, `createGameEntity`; script hooks from Task 12.
- Produces: `class PhysicsCollisionSystem implements NexusSystem` constructed as `new PhysicsCollisionSystem(inertia, scriptManager)`, registered on the `fixed` lane at stage `PhysicsWriteback` after `gameplay:physics-pull`.

- [ ] **Step 1: Append the failing dispatch test**

Append to `packages/gameplay/test/collision-bridge.test.ts` (inside the `describe`, and add `AtlasScript` to imports from `../src`):

Add to the top imports:

```ts
import { AtlasScript, GameEntity } from "../src/scripting";
```

Add these tests:

```ts
  it("dispatches onCollisionEnter to both entities with the other as GameEntity", () => {
    const a: Entity = h.world.createEntity();
    h.world.addComponent(a, Transform2D);
    h.world.addComponent(a, Collider2D, BOX);

    const b: Entity = h.world.createEntity();
    h.world.addComponent(b, Transform2D);
    h.world.addComponent(b, Collider2D, BOX);

    const seenByA: Entity[] = [];

    class Probe extends AtlasScript {
      public onCollisionEnter(other: GameEntity): void {
        seenByA.push(other.id);
      }
    }

    h.scripts.attach(a, Probe);
    h.frame();

    const colliders = [...h.physics.colliders];
    const ca = colliders.find((c) => c.getUserData<Entity>() === a)!;
    const cb = colliders.find((c) => c.getUserData<Entity>() === b)!;

    h.physics.emitCollision(ca, cb, true);
    h.frame();

    expect(seenByA).toContain(b);
  });

  it("routes sensor contacts to onTriggerEnter instead of onCollisionEnter", () => {
    const a: Entity = h.world.createEntity();
    h.world.addComponent(a, Transform2D);
    const colA = h.world.addComponent(a, Collider2D, BOX);
    colA.isSensor = true;

    const b: Entity = h.world.createEntity();
    h.world.addComponent(b, Transform2D);
    h.world.addComponent(b, Collider2D, BOX);

    let collisions: number = 0;
    let triggers: number = 0;

    class Probe extends AtlasScript {
      public onCollisionEnter(): void {
        collisions++;
      }
      public onTriggerEnter(): void {
        triggers++;
      }
    }

    h.scripts.attach(b, Probe);
    h.frame();

    const colliders = [...h.physics.colliders];
    const ca = colliders.find((c) => c.getUserData<Entity>() === a)!;
    const cb = colliders.find((c) => c.getUserData<Entity>() === b)!;

    h.physics.emitCollision(ca, cb, true);
    h.frame();

    expect(triggers).toBe(1);
    expect(collisions).toBe(0);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test -- collision-bridge`
Expected: FAIL — callbacks never fire (no dispatch system yet).

- [ ] **Step 3: Create the system**

Create `packages/gameplay/src/systems/PhysicsCollisionSystem.ts`:

```ts
import { Collider, PhysicsWorld } from "@atlasjs/inertia";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

import { AtlasScript, createGameEntity } from "../scripting/core";
import type { GameEntity } from "../scripting/core";
import { ScriptManager } from "../scripting";

export class PhysicsCollisionSystem implements NexusSystem {
  private readonly inertia: PhysicsWorld;
  private readonly scripts: ScriptManager;

  public constructor(inertia: PhysicsWorld, scripts: ScriptManager) {
    this.inertia = inertia;
    this.scripts = scripts;
  }

  public update({ world }: NexusSystemContext): void {
    this.inertia.drainCollisions(
      (a: Collider, b: Collider, started: boolean) => {
        const ea: Entity | undefined = a.getUserData<Entity>();
        const eb: Entity | undefined = b.getUserData<Entity>();

        if (ea === undefined || eb === undefined) {
          return;
        }

        const trigger: boolean = a.isSensor() || b.isSensor();

        this.dispatch(world, ea, eb, trigger, started);
        this.dispatch(world, eb, ea, trigger, started);
      },
    );
  }

  private dispatch(
    world: NexusWorld,
    self: Entity,
    other: Entity,
    trigger: boolean,
    started: boolean,
  ): void {
    const scripts: readonly AtlasScript[] =
      this.scripts.getScriptsByEntity(self);

    if (scripts.length === 0) {
      return;
    }

    const handle: GameEntity = createGameEntity(other, world, this.scripts);

    for (const script of scripts) {
      if (trigger) {
        if (started) {
          script.onTriggerEnter?.(handle);
        } else {
          script.onTriggerExit?.(handle);
        }
      } else {
        if (started) {
          script.onCollisionEnter?.(handle);
        } else {
          script.onCollisionExit?.(handle);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Export + register the system**

In `packages/gameplay/src/systems/index.ts`, add:

```ts
export * from "./PhysicsCollisionSystem";
```

In `packages/gameplay/src/GameplayPlugin.ts`, add `PhysicsCollisionSystem` to the systems import (lines 16-25), construct it after `physicsPullSystem` (line 71):

```ts
    const physicsCollisionSystem: PhysicsCollisionSystem = new PhysicsCollisionSystem(inertia, this.scriptManager);
```

and register it alongside push/pull (extend the `this.handles.push(...)` block at lines 164-173):

```ts
      registerSystem(fixed, world, physicsCollisionSystem, {
        name: "gameplay:physics-collision",
        stage: "PhysicsWriteback",
        after: "gameplay:physics-pull",
      }),
```

- [ ] **Step 5: Run the dispatch tests + full suite**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (collision-bridge now 7 tests; all other suites green).

- [ ] **Step 6: Hand off** — Suggested: `feat(gameplay): dispatch collision/trigger events to scripts`.

---

# Phase 4 — Sandbox demo & browser verification

### Task 14: Colliders + collision logging in the sandbox, browser-verify

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`
- Modify: `apps/sandbox/src/game/scripts/PlayerMovementScript.ts`

**Interfaces:**
- Consumes: `Collider2D` (as script alias `Collider` or the component), `defineCollisionLayers`, `ColliderShapeDesc` (all from `@atlasjs/gameplay`); the `onCollisionEnter` hook (Task 12).

- [ ] **Step 1: Define layers + give the trees static box colliders**

In `apps/sandbox/src/game/EcsScene.ts`, add `Collider2D`, `defineCollisionLayers`, and `ColliderShapeDesc` to the `@atlasjs/gameplay` import block (lines 19-43):

```ts
  Collider2D,
  defineCollisionLayers,
```

and the type import:

```ts
  type ColliderShapeDesc,
```

Add a module-level layer registry after `const MAP_SCALE: number = 2;` (line 52):

```ts
const Layers = defineCollisionLayers("Player", "Occluder");
```

In the tree loop (lines 225-230), after adding the `SpriteRenderer`, add a static collider:

```ts
      const treeCollider: Collider2D = nexus.addComponent(tree, Collider2D, {
        type: "box",
        width: 24,
        height: 24,
      } as ColliderShapeDesc);
      treeCollider.layer = Layers.Occluder;
      treeCollider.collidesWith = Layers.Player;
```

- [ ] **Step 2: Give the player a collider**

In `initializePlayer`, after `nexus.addComponent(player, PlayerInput, controls);` (line 193), add:

```ts
    const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
      type: "circle",
      radius: 10,
    } as ColliderShapeDesc);
    playerCollider.layer = Layers.Player;
    playerCollider.collidesWith = Layers.Occluder;
```

- [ ] **Step 3: Log collisions from the player script**

In `apps/sandbox/src/game/scripts/PlayerMovementScript.ts`, add the type-only import (per the Vite type-only rule):

```ts
import type { GameEntity } from "@atlasjs/gameplay";
```

Add the hook to the class (after `onUpdate`):

```ts
  public onCollisionEnter(other: GameEntity): void {
    console.log("[collision] player entered", other.id);
  }
```

- [ ] **Step 4: Rebuild changed engine packages so Vite resolves them**

Run: `pnpm --filter @atlasjs/inertia build && pnpm --filter @atlasjs/rapier build && pnpm --filter @atlasjs/gameplay build`
Expected: all PASS.

- [ ] **Step 5: Browser-verify (do not ask the user to check manually)**

Start the sandbox dev server via `preview_start` (name from `.claude/launch.json`; **restart it** rather than reusing a stale HMR session — the sandbox serves stale scenes over HMR). Then:
- `read_console_messages` while driving the player (WASD) into a tree.
- Expected: a `[collision] player entered <id>` line appears when the player's circle overlaps a tree's box, and does NOT appear elsewhere (filtering: Player↔Occluder only).
- If the scene looks stale, inspect via a `window.__scene` stash or reload with `javascript_tool: window.location.reload()`.
- Take a screenshot as proof.

- [ ] **Step 6: Hand off** — Suggested: `feat(sandbox): demo collider layer + collision logging`.

---

## Self-Review

**Spec coverage** (design §A–§F → tasks):
- §B.1 filtering fix → Tasks 3, 4, 5. §B.2 `userData` → Task 2 (+5, 10). §B.3 collider leak → Task 6. §B.4 raycast units + overlaps → Task 7. §B.5 events (queue + drain + `ColliderDesc.events`) → Tasks 2, 5, 6. Dead `converter` removed → Task 2. 
- §C named layers → Task 1 (+ re-export Task 8). §D `Collider2D`/`PhysicsColliderRef` + create/cleanup → Tasks 8, 9, 11. §E lifecycle + dispatch system → Tasks 12, 13. §F sandbox + tests → Tasks 10 (infra), 11 & 13 (harness tests), 14 (browser).

**Placeholder scan:** none — every code step is complete. WASM behavior (real filtering/events/queries) has no unit test by design (no WASM harness); this is stated explicitly and covered by build + the Task 14 browser-verify.

**Type consistency:** `packCollisionGroups(membership, filter)` used identically in Tasks 3/4/5. `CollisionHandler = (a, b, started)` identical in inertia/rapier/fake/system (Tasks 2, 6, 10, 13). `Collider2D` fields (`layer`, `collidesWith`, `offset`, `shape`, …) consistent across Tasks 8, 11, 14. `PhysicsColliderRef.collider` consistent across Tasks 9, 11. `drainCollisions` signature identical everywhere.

**Ordering note:** Task 6 leaves `rapier` temporarily non-building (query arity) until Task 7; run and hand off 6+7 together. All other tasks leave the workspace green.
