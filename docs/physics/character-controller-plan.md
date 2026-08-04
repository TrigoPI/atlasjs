# Character Controller & World Solidity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dino-brawl world solid — the kinematic player bumps into and slides along trees/pillars/walls — by wiring rapier's built-in `KinematicCharacterController` through the engine and driving the player with a Unity-style `move(delta)`.

**Architecture:** `@atlasjs/inertia` gains a backend-agnostic `CharacterController` contract (`computeMovement(collider, desired) → correctedDelta`) + `PhysicsWorld.createCharacterController/destroyCharacterController`. `@atlasjs/rapier` implements it over `KinematicCharacterController` with unit conversion. `@atlasjs/gameplay` bridges it with a LEVEL-1 `CharacterController2D` (config) + `CharacterControllerRef` (handle, minted by `PhysicsPushSystem`, torn down in `GameplayPlugin`) and a LEVEL-2 behavioral token `CharacterController` whose `move(delta)` runs collide-and-slide and writes the `Transform2D`. `apps/dino-brawl` reads a new Tiled `colliders` objectgroup into static `Collider2D` boxes on a new `World` collision layer, and the player script calls `move()`.

**Tech Stack:** TypeScript, pnpm/Turborepo monorepo, `@dimforge/rapier2d-compat@0.19.3` (`world.createCharacterController(offset)`, `computeColliderMovement`/`computedMovement`), Nexus ECS, Vitest, tsdown.

Design doc: [`character-controller.md`](character-controller.md). Prior phase: [`collision-layer.md`](collision-layer.md) (collision events, shipped).

## Global Constraints

Every task's requirements implicitly include this section:

- **No comments in code.** Semantics live in the docs, not inline comments.
- **Type everything**, even trivially (function params, variables, class fields).
- **No circular dependencies.** Direction stays `rapier → inertia`, `gameplay → inertia`; `inertia` never imports `rapier`/`gameplay`. App-only code stays in `apps/dino-brawl`.
- **Typecheck with `tsc --noEmit`** — never `tsc -b`. Gameplay: `pnpm --filter @atlasjs/gameplay typecheck`.
- **Rebuild a dependency's `dist` after changing its public API** so downstream typecheck and the `dino-brawl` Vite preview resolve it: `pnpm --filter @atlasjs/inertia build`, then `pnpm --filter @atlasjs/rapier build`, then `pnpm --filter @atlasjs/gameplay build`.
- **In app/script files (`apps/dino-brawl`), `import type` type-only symbols; `import` (value) anything used at runtime.** A value symbol imported as `import type` breaks the Vite runtime (black screen); e.g. `Vec2` and the `CharacterController` token are **value** imports. Browser-verify covers this.
- **Do NOT commit automatically.** Each task ends green and is handed off for the user to review and commit. "Hand off" is the user's checkpoint, not an agent `git commit`.
- **Two component levels (gameplay):** system-driven Nexus data → `components/` (no `*Component` suffix, e.g. `CharacterController2D`, `CharacterControllerRef`). Curated script name hiding real behavior → `scripting/components/` via `defineScriptComponent(engine, create)` (`CharacterController`). Don't add a behavioral token without real behavior.
- **`offset` is rapier-native (physics/meters), default `0.01`, NOT unit-converted.** Only `desired`/`computedMovement` are converted (dino-brawl `unitsPerMeter: 100`).

## File Structure

**`@atlasjs/inertia`**
- `src/CharacterController.ts` — **delete** dead platformer helper, **recreate** as the `CharacterController` interface.
- `src/inertial-type.ts` — remove old `CharacterControllerOptions`/`CharacterControllerState`; add new `CharacterControllerOptions`.
- `src/PhysicsWorld.ts` — add `createCharacterController`/`destroyCharacterController`.
- `src/index.ts` — export `./CharacterController`.

**`@atlasjs/rapier`**
- `src/RapierCharacterController.ts` — **new** wrapper over `KinematicCharacterController`.
- `src/RapierPhysicsWorld.ts` — implement the two new methods + registry + `clear()`.
- `src/index.ts` — export `./RapierCharacterController`.
- `test/character-controller.test.ts` — **new** real-rapier collide-and-slide + unit test.

**`@atlasjs/gameplay`**
- `src/components/CharacterController2D.ts`, `src/components/CharacterControllerRef.ts` — **new**.
- `src/components/index.ts` — export both.
- `src/scripting/components/CharacterController.ts` — **new** behavioral token.
- `src/scripting/components/index.ts` — export token.
- `src/systems/PhysicsPushSystem.ts` — controller-creation pass.
- `src/GameplayPlugin.ts` — `defineComponent` + `onRemove` teardown.
- `test/helpers/fake-physics.ts` — `FakeCharacterController` + world methods (test infra).
- `test/character-controller-component.test.ts`, `test/character-controller-bridge.test.ts`, `test/character-controller-token.test.ts` — **new**.

**`apps/dino-brawl`**
- `src/game/config.ts` — add `World` collision layer.
- `src/game/tiled/ingestColliders.ts` — **new** (mirror `ingestOccluders.ts`).
- `test/tiled/ingestColliders.test.ts` — **new**.
- `src/game/tiled/MapBuilder.ts` — call `ingestColliders`.
- `src/game/spawn/spawnPlayer.ts` — add `CharacterController2D`, set `collidesWith = World`.
- `src/game/scripts/PlayerMovementScript.ts` — drive movement via `move()`.
- `maps/dino_brawl.json` — add `colliders` objectgroup.

---

## Task 1: inertia `CharacterController` contract (+ compile-safe stubs)

**Files:**
- Delete + Create: `packages/inertia/src/CharacterController.ts`
- Modify: `packages/inertia/src/inertial-type.ts` (remove old `CharacterControllerOptions`/`CharacterControllerState`, add new options)
- Modify: `packages/inertia/src/PhysicsWorld.ts`
- Modify: `packages/inertia/src/index.ts`
- Modify: `packages/rapier/src/RapierPhysicsWorld.ts` (throwing stubs — real impl in Task 2)
- Modify: `packages/gameplay/test/helpers/fake-physics.ts` (full fake — reused Task 4/5)

**Interfaces:**
- Produces: `interface CharacterController { computeMovement(collider: Collider, desired: Vec2): Vec2 }`; `type CharacterControllerOptions = { readonly offset?: number; readonly slide?: boolean }`; `PhysicsWorld.createCharacterController(options?: CharacterControllerOptions): CharacterController`; `PhysicsWorld.destroyCharacterController(controller: CharacterController): void`; `class FakeCharacterController` (test).

- [ ] **Step 1: Verify the old helper is dead** — confirm nothing outside its own files references it.

Run: `grep -rn "CharacterController" packages apps --include="*.ts" | grep -v "packages/inertia/src/CharacterController.ts" | grep -vE "CharacterControllerOptions|CharacterControllerState"`
Expected: no matches (orphan). (`CharacterControllerOptions`/`State` themselves have 0 external users — also safe to replace.)

- [ ] **Step 2: Replace the interface file** — overwrite `packages/inertia/src/CharacterController.ts`:

```ts
import { Vec2 } from "@atlasjs/math";
import { Collider } from "./Collider";

export interface CharacterController {
  computeMovement(collider: Collider, desired: Vec2): Vec2;
}
```

- [ ] **Step 3: Swap the options type** in `packages/inertia/src/inertial-type.ts` — delete the existing `CharacterControllerOptions` and `CharacterControllerState` blocks and add:

```ts
export type CharacterControllerOptions = {
  readonly offset?: number;
  readonly slide?: boolean;
};
```

- [ ] **Step 4: Extend `PhysicsWorld`** — in `packages/inertia/src/PhysicsWorld.ts`, add imports and two methods to the interface:

```ts
import { CharacterController } from "./CharacterController";
import { RigidBodyDesc, ColliderDesc, CollisionHandler, CharacterControllerOptions } from "./inertial-type";
```
```ts
  createCharacterController(options?: CharacterControllerOptions): CharacterController;
  destroyCharacterController(controller: CharacterController): void;
```

- [ ] **Step 5: Barrel** — add to `packages/inertia/src/index.ts`:

```ts
export * from "./CharacterController";
```

- [ ] **Step 6: Rapier compile-safe stub** — in `packages/rapier/src/RapierPhysicsWorld.ts` add to the `@atlasjs/inertia` import list `CharacterController, CharacterControllerOptions`, and add (real implementation lands in Task 2):

```ts
  public createCharacterController(_options?: CharacterControllerOptions): CharacterController {
    throw new Error("createCharacterController not implemented yet");
  }

  public destroyCharacterController(_controller: CharacterController): void {
    throw new Error("destroyCharacterController not implemented yet");
  }
```

- [ ] **Step 7: Full fake** — in `packages/gameplay/test/helpers/fake-physics.ts` add `CharacterController, CharacterControllerOptions` to the inertia import, add the class, the registry field, and the two methods:

```ts
export class FakeCharacterController implements CharacterController {
  public factor: number;
  public lastCollider: Collider | null;
  public lastDesired: Vec2 | null;

  public constructor() {
    this.factor = 1;
    this.lastCollider = null;
    this.lastDesired = null;
  }

  public computeMovement(collider: Collider, desired: Vec2): Vec2 {
    this.lastCollider = collider;
    this.lastDesired = desired.clone();
    return new Vec2(desired.x * this.factor, desired.y * this.factor);
  }
}
```
Inside `FakePhysicsWorld`: declare `public readonly characterControllers: Set<FakeCharacterController>;`, init `this.characterControllers = new Set();` in the constructor, add to `clear()` the line `this.characterControllers.clear();`, and add:
```ts
  public get characterControllerCount(): number {
    return this.characterControllers.size;
  }

  public createCharacterController(_options?: CharacterControllerOptions): CharacterController {
    const controller: FakeCharacterController = new FakeCharacterController();
    this.characterControllers.add(controller);
    return controller;
  }

  public destroyCharacterController(controller: CharacterController): void {
    this.characterControllers.delete(controller as FakeCharacterController);
  }
```

- [ ] **Step 8: Build + typecheck all three packages**

Run: `pnpm --filter @atlasjs/inertia build && pnpm --filter @atlasjs/rapier typecheck && pnpm --filter @atlasjs/gameplay test`
Expected: inertia builds; rapier typechecks (stub satisfies the interface); gameplay's existing suite stays green (fake compiles).

- [ ] **Step 9: Hand off** for review + commit.

---

## Task 2: rapier `RapierCharacterController` (real collide-and-slide)

**Files:**
- Create: `packages/rapier/src/RapierCharacterController.ts`
- Modify: `packages/rapier/src/RapierPhysicsWorld.ts` (replace the Task-1 stubs, add registry + `clear()`)
- Modify: `packages/rapier/src/index.ts`
- Test: `packages/rapier/test/character-controller.test.ts`

**Interfaces:**
- Consumes: `CharacterController`, `CharacterControllerOptions`, `Collider` (inertia); `RapierCollider.rapierCollider`; `PhysicsUnitConverter.vecToPhysics/vecToWorld`.
- Produces: `class RapierCharacterController implements CharacterController { readonly raw: RAPIER.KinematicCharacterController; computeMovement(collider, desired): Vec2 }`.

- [ ] **Step 1: Write the failing test** — `packages/rapier/test/character-controller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS } from "@atlasjs/inertia";
import type { Collider, RigidBody, CharacterController } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "../src/RapierPhysicsWorld";

async function makeWorld(): Promise<RapierPhysicsWorld> {
  const world: RapierPhysicsWorld = new RapierPhysicsWorld({
    gravity: new Vec2(0, 0),
    unitsPerMeter: 100,
  });
  await world.init();
  return world;
}

describe("RapierCharacterController collide-and-slide", () => {
  it("clamps movement into a static box and returns world units", async () => {
    const world: RapierPhysicsWorld = await makeWorld();

    world.createCollider({
      shape: { type: "box", width: 200, height: 200 },
      translation: new Vec2(0, 0),
      collisionGroup: ALL_LAYERS,
      collisionMask: ALL_LAYERS,
    });

    const body: RigidBody = world.createRigidBody({
      type: "kinematic",
      translation: new Vec2(-300, 0),
    });
    const player: Collider = world.createCollider(
      {
        shape: { type: "circle", radius: 50 },
        collisionGroup: ALL_LAYERS,
        collisionMask: ALL_LAYERS,
      },
      body,
    );

    world.step(1 / 60);

    const controller: CharacterController = world.createCharacterController({ slide: true });
    const moved: Vec2 = controller.computeMovement(player, new Vec2(300, 0));

    expect(moved.x).toBeLessThan(300);
    expect(moved.x).toBeGreaterThan(100);
    expect(moved.x).toBeLessThan(200);
  });

  it("allows full movement in free space", async () => {
    const world: RapierPhysicsWorld = await makeWorld();
    const body: RigidBody = world.createRigidBody({ type: "kinematic", translation: new Vec2(0, 0) });
    const player: Collider = world.createCollider(
      { shape: { type: "circle", radius: 50 }, collisionGroup: ALL_LAYERS, collisionMask: ALL_LAYERS },
      body,
    );
    world.step(1 / 60);

    const controller: CharacterController = world.createCharacterController({});
    const moved: Vec2 = controller.computeMovement(player, new Vec2(300, 0));

    expect(moved.x).toBeGreaterThan(290);
  });
});
```

- [ ] **Step 2: Run it — fails** (stub throws).

Run: `pnpm --filter @atlasjs/rapier test -- character-controller`
Expected: FAIL ("createCharacterController not implemented yet").

- [ ] **Step 3: Implement the wrapper** — `packages/rapier/src/RapierCharacterController.ts`:

```ts
import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";
import { CharacterController, Collider } from "@atlasjs/inertia";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";
import { RapierCollider } from "./RapierCollider";

export class RapierCharacterController implements CharacterController {
  public readonly raw: RAPIER.KinematicCharacterController;
  private readonly converter: PhysicsUnitConverter;

  public constructor(raw: RAPIER.KinematicCharacterController, converter: PhysicsUnitConverter) {
    this.raw = raw;
    this.converter = converter;
  }

  public computeMovement(collider: Collider, desired: Vec2): Vec2 {
    if (!(collider instanceof RapierCollider)) {
      throw new Error("RapierCharacterController requires a RapierCollider.");
    }

    const desiredPhysics: Vec2 = this.converter.vecToPhysics(desired);

    this.raw.computeColliderMovement(
      collider.rapierCollider,
      { x: desiredPhysics.x, y: desiredPhysics.y },
      undefined,
      collider.rapierCollider.collisionGroups(),
    );

    const moved: RAPIER.Vector = this.raw.computedMovement();
    return this.converter.vecToWorld(new Vec2(moved.x, moved.y));
  }
}
```

- [ ] **Step 4: Replace the stubs** in `packages/rapier/src/RapierPhysicsWorld.ts`. Add import `import { RapierCharacterController } from "./RapierCharacterController";`, declare `private readonly controllers: Set<RapierCharacterController>;`, init `this.controllers = new Set();` in the constructor, and replace the two stub methods:

```ts
  public createCharacterController(options: CharacterControllerOptions = {}): CharacterController {
    const raw: RAPIER.KinematicCharacterController = this.world.createCharacterController(options.offset ?? 0.01);
    raw.setSlideEnabled(options.slide ?? true);
    const wrapper: RapierCharacterController = new RapierCharacterController(raw, this.converter);
    this.controllers.add(wrapper);
    return wrapper;
  }

  public destroyCharacterController(controller: CharacterController): void {
    if (!(controller instanceof RapierCharacterController)) {
      throw new Error("Invalid CharacterController");
    }
    this.world.removeCharacterController(controller.raw);
    this.controllers.delete(controller);
  }
```
In `clear()`, before removing colliders, add:
```ts
    for (const controller of [...this.controllers.values()]) {
      this.destroyCharacterController(controller);
    }
```

- [ ] **Step 5: Barrel** — add to `packages/rapier/src/index.ts`: `export * from "./RapierCharacterController";`

- [ ] **Step 6: Run tests — pass.** Run: `pnpm --filter @atlasjs/rapier test`
Expected: new file green (both cases), existing rapier tests still green. If `moved.x` lands outside `(100, 200)`, widen only the outer bounds — the invariants are `0 < moved.x < 300` (clamped) and `moved.x > ~1.5` scale (world units, not physics).

- [ ] **Step 7: Rebuild dist.** Run: `pnpm --filter @atlasjs/rapier build`

- [ ] **Step 8: Hand off.**

---

## Task 3: gameplay `CharacterController2D` + `CharacterControllerRef` components

**Files:**
- Create: `packages/gameplay/src/components/CharacterController2D.ts`
- Create: `packages/gameplay/src/components/CharacterControllerRef.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Test: `packages/gameplay/test/character-controller-component.test.ts`

**Interfaces:**
- Consumes: `CharacterController` (inertia).
- Produces: `class CharacterController2D { offset: number; slide: boolean; constructor(options?: { offset?: number; slide?: boolean }) }`; `class CharacterControllerRef { readonly controller: CharacterController; constructor(controller) }`.

- [ ] **Step 1: Write the failing test** — `packages/gameplay/test/character-controller-component.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CharacterController2D } from "../src/components/CharacterController2D";

describe("CharacterController2D", () => {
  it("defaults to offset 0.01 and slide true", () => {
    const cc: CharacterController2D = new CharacterController2D();
    expect(cc.offset).toBe(0.01);
    expect(cc.slide).toBe(true);
  });

  it("honours overrides", () => {
    const cc: CharacterController2D = new CharacterController2D({ offset: 0.5, slide: false });
    expect(cc.offset).toBe(0.5);
    expect(cc.slide).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fails** (module missing). Run: `pnpm --filter @atlasjs/gameplay test -- character-controller-component`

- [ ] **Step 3: Implement components.**

`packages/gameplay/src/components/CharacterController2D.ts`:
```ts
export class CharacterController2D {
  public offset: number;
  public slide: boolean;

  public constructor(options: { offset?: number; slide?: boolean } = {}) {
    this.offset = options.offset ?? 0.01;
    this.slide = options.slide ?? true;
  }
}
```
`packages/gameplay/src/components/CharacterControllerRef.ts`:
```ts
import { CharacterController } from "@atlasjs/inertia";

export class CharacterControllerRef {
  public readonly controller: CharacterController;

  public constructor(controller: CharacterController) {
    this.controller = controller;
  }
}
```

- [ ] **Step 4: Barrel** — add to `packages/gameplay/src/components/index.ts`:
```ts
export * from "./CharacterController2D";
export * from "./CharacterControllerRef";
```

- [ ] **Step 5: Run — pass.** Run: `pnpm --filter @atlasjs/gameplay test -- character-controller-component`

- [ ] **Step 6: Hand off.**

---

## Task 4: controller lifecycle bridge (push-creation + plugin teardown)

**Files:**
- Modify: `packages/gameplay/src/systems/PhysicsPushSystem.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Test: `packages/gameplay/test/character-controller-bridge.test.ts`

**Interfaces:**
- Consumes: `CharacterController2D`, `CharacterControllerRef` (components); `PhysicsWorld.createCharacterController/destroyCharacterController`; `FakePhysicsWorld.characterControllerCount` (test); harness `createHarness()`/`frame()`.
- Produces: after the push runs, an entity with `CharacterController2D` and no ref gains a `CharacterControllerRef`; destroying the entity frees the controller.

- [ ] **Step 1: Write the failing integration test** — `packages/gameplay/test/character-controller-bridge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHarness, Harness } from "./helpers/harness";
import { CharacterController2D } from "../src/components/CharacterController2D";
import { CharacterControllerRef } from "../src/components/CharacterControllerRef";
import type { Entity } from "@atlasjs/nexus";

describe("CharacterController lifecycle bridge", () => {
  it("mints a CharacterControllerRef and a physics controller when CharacterController2D appears", async () => {
    const h: Harness = await createHarness();
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, CharacterController2D);

    h.frame();

    expect(h.world.hasComponent(e, CharacterControllerRef)).toBe(true);
    expect(h.physics.characterControllerCount).toBe(1);
  });

  it("frees the controller when the entity is destroyed", async () => {
    const h: Harness = await createHarness();
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, CharacterController2D);
    h.frame();

    h.world.destroyEntity(e);
    h.frame();

    expect(h.physics.characterControllerCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fails** (no ref minted). Run: `pnpm --filter @atlasjs/gameplay test -- character-controller-bridge`

- [ ] **Step 3: Add the creation pass** in `packages/gameplay/src/systems/PhysicsPushSystem.ts`. Add `CharacterController2D, CharacterControllerRef` to the `../components` import, declare `private readonly pendingControllers: Entity[];` and init `this.pendingControllers = [];` in the constructor. At the end of `update(...)`, after the collider-creation block:

```ts
    world.query(CharacterController2D).without(CharacterControllerRef).each((entity) => {
      this.pendingControllers.push(entity);
    });

    for (const entity of this.pendingControllers) {
      const cfg: CharacterController2D = world.requireComponent(entity, CharacterController2D);
      const controller: CharacterController = this.inertia.createCharacterController({
        offset: cfg.offset,
        slide: cfg.slide,
      });
      world.addComponent(entity, CharacterControllerRef, controller);
    }

    this.pendingControllers.length = 0;
```
Add `CharacterController` to the `@atlasjs/inertia` import at the top of the file.

- [ ] **Step 4: Wire the plugin** in `packages/gameplay/src/GameplayPlugin.ts`. Add `CharacterController2D, CharacterControllerRef` to the `./components` import. Add both to the `defineComponent` chain:
```ts
      .defineComponent(CharacterController2D)
      .defineComponent(CharacterControllerRef)
```
Add two `onRemove` hooks to the `this.unsubscribers.push(...)` block (mirror the collider pair):
```ts
      world.onRemove(CharacterControllerRef, (_entity: Entity, ref: CharacterControllerRef) => {
        inertia.destroyCharacterController(ref.controller);
      }),

      world.onRemove(CharacterController2D, (entity: Entity) => {
        if (world.hasComponent(entity, CharacterControllerRef)) {
          world.removeComponent(entity, CharacterControllerRef);
        }
      }),
```

- [ ] **Step 5: Run — pass** (both cases), plus the full suite. Run: `pnpm --filter @atlasjs/gameplay test`

- [ ] **Step 6: Hand off.**

---

## Task 5: gameplay `CharacterController` script token (`move`)

**Files:**
- Create: `packages/gameplay/src/scripting/components/CharacterController.ts`
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Test: `packages/gameplay/test/character-controller-token.test.ts`

**Interfaces:**
- Consumes: `defineScriptComponent`; `CharacterController2D`, `CharacterControllerRef`, `PhysicsColliderRef`, `Transform2D`; `FakeCharacterController`, `FakeCollider` (test).
- Produces: `interface CharacterController { move(delta: Vec2): Vec2 }`; `const CharacterController` (behavioral token over `CharacterController2D`). `move` calls `ref.controller.computeMovement(collider, delta)`, adds the result to `Transform2D.position`, and returns it.

- [ ] **Step 1: Write the failing test** — `packages/gameplay/test/character-controller-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { NexusWorld, ComponentRegistry } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { Transform2D } from "../src/components/Transform2D";
import { CharacterController2D } from "../src/components/CharacterController2D";
import { CharacterControllerRef } from "../src/components/CharacterControllerRef";
import { PhysicsColliderRef } from "../src/components/PhysicsColliderRef";
import { CharacterController } from "../src/scripting/components/CharacterController";
import { FakeCharacterController, FakeCollider } from "./helpers/fake-physics";
import type { CharacterController as CharacterControllerApi } from "../src/scripting/components/CharacterController";

describe("CharacterController token move()", () => {
  it("applies the collide-and-slide corrected delta to the Transform2D", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world
      .defineComponent(Transform2D)
      .defineComponent(CharacterController2D)
      .defineComponent(CharacterControllerRef)
      .defineComponent(PhysicsColliderRef);

    const e: Entity = world.createEntity();
    world.addComponent(e, Transform2D);
    world.addComponent(e, CharacterController2D);

    const collider: FakeCollider = new FakeCollider("c", { shape: { type: "circle", radius: 1 } }, null);
    world.addComponent(e, PhysicsColliderRef, collider);

    const controller: FakeCharacterController = new FakeCharacterController();
    controller.factor = 0.5;
    world.addComponent(e, CharacterControllerRef, controller);

    const api: CharacterControllerApi = CharacterController.create(world, e);
    const moved: Vec2 = api.move(new Vec2(10, 4));

    expect(moved.x).toBe(5);
    expect(moved.y).toBe(2);
    expect(controller.lastCollider).toBe(collider);

    const t: Transform2D = world.requireComponent(e, Transform2D);
    expect(t.position.x).toBe(5);
    expect(t.position.y).toBe(2);
  });
});
```

- [ ] **Step 2: Run — fails** (module missing). Run: `pnpm --filter @atlasjs/gameplay test -- character-controller-token`

- [ ] **Step 3: Implement the token** — `packages/gameplay/src/scripting/components/CharacterController.ts`:

```ts
import { Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  CharacterController2D,
  CharacterControllerRef,
  PhysicsColliderRef,
  Transform2D,
} from "../../components";

export interface CharacterController {
  move(delta: Vec2): Vec2;
}

function createCharacterController(world: NexusWorld, entity: Entity): CharacterController {
  return {
    move(delta: Vec2): Vec2 {
      const ref: CharacterControllerRef = world.requireComponent(entity, CharacterControllerRef);
      const colliderRef: PhysicsColliderRef = world.requireComponent(entity, PhysicsColliderRef);
      const transform: Transform2D = world.requireComponent(entity, Transform2D);

      const moved: Vec2 = ref.controller.computeMovement(colliderRef.collider, delta);
      transform.position.set(transform.position.x + moved.x, transform.position.y + moved.y);
      return moved;
    },
  };
}

export const CharacterController = defineScriptComponent(CharacterController2D, createCharacterController);
```

- [ ] **Step 4: Barrel** — add to `packages/gameplay/src/scripting/components/index.ts`: `export * from "./CharacterController";`

- [ ] **Step 5: Run — pass**, then full suite + typecheck. Run: `pnpm --filter @atlasjs/gameplay test && pnpm --filter @atlasjs/gameplay typecheck`

- [ ] **Step 6: Rebuild dist** (public API changed — the app's Vite needs it): `pnpm --filter @atlasjs/gameplay build`

- [ ] **Step 7: Hand off.**

---

## Task 6: dino-brawl `World` layer + `ingestColliders`

**Files:**
- Modify: `apps/dino-brawl/src/game/config.ts`
- Create: `apps/dino-brawl/src/game/tiled/ingestColliders.ts`
- Modify: `apps/dino-brawl/src/game/tiled/MapBuilder.ts`
- Test: `apps/dino-brawl/test/tiled/ingestColliders.test.ts`

**Interfaces:**
- Consumes: `colliderFromRect`, `RectObject`/`ResolvedObject`, `TiledDocument`; `Collider2D`, `Transform2D`; `CollisionLayers.World`.
- Produces: `isColliderObject(obj): obj is RectObject`; `ingestColliders(nexus, doc, scale, layer, logger): number` — one world-space static box `Collider2D` entity per rect on the `colliders` layer, centered, `× scale`, `layer` set. **Not parented to the Grid** (world-space, so the box size isn't affected by the Grid's scale).

- [ ] **Step 1: Add the `World` layer** in `apps/dino-brawl/src/game/config.ts`:
```ts
export const CollisionLayers = defineCollisionLayers("Player", "Occluder", "World");
```

- [ ] **Step 2: Write the failing test** — `apps/dino-brawl/test/tiled/ingestColliders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLogger } from "@atlasjs/utils";
import { NexusWorld, ComponentRegistry } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { Collider2D, Transform2D } from "@atlasjs/gameplay";

import { TiledDocument } from "../../src/game/tiled/TiledDocument";
import { ingestColliders, isColliderObject } from "../../src/game/tiled/ingestColliders";
import { CollisionLayers } from "../../src/game/config";

const fixture = {
  width: 2,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [],
  layers: [
    { type: "objectgroup", name: "colliders", objects: [{ id: 1, name: "", x: 100, y: 200, width: 32, height: 64 }] },
    { type: "objectgroup", name: "occluder_regions", objects: [{ id: 2, name: "", x: 0, y: 0, width: 32, height: 32 }] },
    { type: "objectgroup", name: "spawn_point", objects: [{ id: 3, name: "spawn", x: 10, y: 10, point: true }] },
  ],
};

describe("collider ingestion (Tiled)", () => {
  it("detects rects on the 'colliders' layer and rejects the others", () => {
    const doc = new TiledDocument(fixture);
    const hits = doc.objects.filter(isColliderObject);
    expect(hits).toHaveLength(1);
    expect(hits[0].width).toBe(32);

    const occluder = doc.objects.find((o) => o.groupPath.includes("occluder_regions"));
    expect(isColliderObject(occluder!)).toBe(false);
  });

  it("spawns one scaled, centered static box collider per collider rect", () => {
    const doc = new TiledDocument(fixture);
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world.defineComponent(Transform2D).defineComponent(Collider2D);

    const count: number = ingestColliders(world, doc, 2, CollisionLayers.World, createLogger("test"));
    expect(count).toBe(1);

    const entities: Entity[] = world.query(Transform2D, Collider2D).getEntities();
    expect(entities).toHaveLength(1);

    const t: Transform2D = world.requireComponent(entities[0], Transform2D);
    expect(t.position.x).toBe(232);
    expect(t.position.y).toBe(464);

    const c: Collider2D = world.requireComponent(entities[0], Collider2D);
    expect(c.shape).toEqual({ type: "box", width: 64, height: 128 });
    expect(c.layer).toBe(CollisionLayers.World);
  });
});
```

- [ ] **Step 3: Run — fails** (module missing). Run: `pnpm --filter dino-brawl test -- ingestColliders`

- [ ] **Step 4: Implement** — `apps/dino-brawl/src/game/tiled/ingestColliders.ts`:

```ts
import type { Logger } from "@atlasjs/utils";
import type { CollisionLayer } from "@atlasjs/inertia";
import type { Entity, NexusWorld } from "@atlasjs/nexus";
import { Collider2D, Transform2D } from "@atlasjs/gameplay";

import type { MapCollider } from "./mapMath";
import type { TiledDocument } from "./TiledDocument";
import type { RectObject, ResolvedObject } from "./resolved.types";
import { colliderFromRect } from "./mapMath";

export function isColliderObject(obj: ResolvedObject): obj is RectObject {
  return (
    obj.kind === "rect" &&
    (obj.groupPath.includes("colliders") || obj.properties.collider === true)
  );
}

export function ingestColliders(
  nexus: NexusWorld,
  doc: TiledDocument,
  scale: number,
  layer: CollisionLayer,
  logger: Logger,
): number {
  let count: number = 0;

  for (const obj of doc.objects) {
    if (!isColliderObject(obj)) {
      continue;
    }

    const world: MapCollider = colliderFromRect(obj, scale);
    const entity: Entity = nexus.createEntity();

    const transform: Transform2D = nexus.addComponent(entity, Transform2D);
    transform.position.set(world.x + world.width / 2, world.y + world.height / 2);

    const collider: Collider2D = nexus.addComponent(entity, Collider2D, {
      type: "box",
      width: world.width,
      height: world.height,
    });
    collider.layer = layer;

    count++;
  }

  if (count > 0) {
    logger.log(`Ingested ${count} world collider(s) from the 'colliders' layer.`);
  }

  return count;
}
```

- [ ] **Step 5: Wire it into `MapBuilder`** — in `apps/dino-brawl/src/game/tiled/MapBuilder.ts`, add the import `import { ingestColliders } from "./ingestColliders";` and `import { CollisionLayers } from "../config";`, then immediately after the existing `ingestOccluders(...)` call add:

```ts
    ingestColliders(nexus, doc, options.scale, CollisionLayers.World, logger);
```
(The dead `BuiltMap.colliders` data array — populated by the existing rect branch — has no consumers; leave it untouched. `ingestColliders` is the authoritative entity path. Removing the dead field is a separate cleanup → backlog.)

- [ ] **Step 6: Run — pass.** Run: `pnpm --filter dino-brawl test -- ingestColliders`

- [ ] **Step 7: Hand off.**

---

## Task 7: dino-brawl player uses the character controller

**Files:**
- Modify: `apps/dino-brawl/src/game/spawn/spawnPlayer.ts`
- Modify: `apps/dino-brawl/src/game/scripts/PlayerMovementScript.ts`

No unit test — app scripts, verified in Task 9 (browser). Gate: typecheck + Vite import discipline.

**Interfaces:**
- Consumes: `CharacterController2D` (component), `CharacterController` (token), `CollisionLayers.World`.

- [ ] **Step 1: spawnPlayer** — in `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` add `CharacterController2D` to the `@atlasjs/gameplay` import, and after the collider block:
```ts
  nexus.addComponent(player, CharacterController2D);
```
Change the collider filter from `Occluder` to `World`:
```ts
  playerCollider.layer = CollisionLayers.Player;
  playerCollider.collidesWith = CollisionLayers.World;
```

- [ ] **Step 2: PlayerMovementScript** — rewrite `apps/dino-brawl/src/game/scripts/PlayerMovementScript.ts` to drive movement through `move()`. Note `Vec2` and `CharacterController` are **value** imports:

```ts
import { Vec2 } from "@atlasjs/math";
import type { GameEntity } from "@atlasjs/gameplay";
import type { DinoControls } from "../controls";

import {
  AtlasScript,
  ButtonAction,
  CharacterController,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Vector2Action,
} from "@atlasjs/gameplay";

export class PlayerMovementScript extends AtlasScript<{ speed: number }> {
  private readonly speed: number;

  private character: CharacterController;

  private move: Vector2Action;
  private boost: ButtonAction;

  // prettier-ignore
  public onCreate(): void {
    const actions: PlayerInput<DinoControls> = this.requireComponent(PlayerInput);

    this.character = this.requireComponent(CharacterController);

    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.character.move(new Vec2(v.x * speed * dt, v.y * speed * dt));
    }
  }

  public onCollisionEnter(other: GameEntity): void {
    console.log("[collision] player entered", other.id);
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    speed: ScriptMetadata.field({ required: true }),
  },
});
```

- [ ] **Step 3: Typecheck the app.** Run: `pnpm --filter dino-brawl typecheck` (or `tsc --noEmit` in the app)
Expected: clean.

- [ ] **Step 4: Hand off.**

---

## Task 8: dino-brawl map — `colliders` objectgroup

**Files:**
- Modify: `apps/dino-brawl/maps/dino_brawl.json`

- [ ] **Step 1: Add the objectgroup.** In the `systems` group (next to `occluder_regions`), add an objectgroup named `colliders` with one rect per solid obstacle. Reuse the 9 `occluder_regions` rects as a starting set (same trunk/pillar footprints), then tune in the browser. Each object is a plain rect:
```json
{ "type": "objectgroup", "name": "colliders", "objects": [
  { "id": 900, "name": "", "x": 416, "y": 480, "width": 32, "height": 96 }
] }
```
(Add the remaining rects mirroring the `occluder_regions` coordinates; ids must be unique across the map.)

- [ ] **Step 2: Validate JSON.** Run: `node -e "JSON.parse(require('fs').readFileSync('apps/dino-brawl/maps/dino_brawl.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Confirm ingestion parses them** (fast unit-level sanity, no browser). Run: `pnpm --filter dino-brawl test -- ingestColliders`
Expected: still green (fixture-based; this step just guards against an accidental test break).

- [ ] **Step 4: Hand off.**

---

## Task 9: browser-verify end-to-end

**Files:** none (verification).

- [ ] **Step 1: Rebuild changed packages** so Vite resolves them: `pnpm --filter @atlasjs/inertia build && pnpm --filter @atlasjs/rapier build && pnpm --filter @atlasjs/gameplay build`

- [ ] **Step 2: Launch the dev server** via the preview tool (never `Bash`): `preview_start { name: "dino-brawl" }` (add a `.claude/launch.json` entry if absent). Restart the server rather than trusting HMR (sandbox HMR serves stale scenes).

- [ ] **Step 3: Verify no errors** — `read_console_messages` (errors only) + `preview_logs`. A black screen ⇒ a value symbol imported as `import type` (check `Vec2`, `CharacterController` in the player script).

- [ ] **Step 4: Verify solidity** — drive the player (keyboard via `computer`) into a tree/pillar. Expected: the player **stops** at the obstacle and **slides** along it instead of passing through; `[collision] player entered` still logs. Screenshot before/after contact for the user.

- [ ] **Step 5: Tune if needed** — if the player floats off walls or clips in: adjust `CharacterController2D` `offset` (spawnPlayer), the player collider `radius`, or the Tiled rect sizes. Re-verify. Record final values.

- [ ] **Step 6: Hand off** with screenshots + a one-line note on any tuning applied.

---

## Self-Review

- **Spec coverage:** inertia contract (§4 → T1), rapier backend + units (§5 → T2), components (§6 → T3), push-creation + teardown (§6/§7 → T4), token `move` (§6 → T5), `World` layer + `ingestColliders` + MapBuilder (§8 → T6), spawnPlayer + script (§8 → T7), map JSON (§8 → T8), browser-verify + tuning (§9/§10 → T9). All design sections mapped.
- **Placeholders:** none — every code/test step carries actual content.
- **Type consistency:** `CharacterController` (inertia interface) vs `CharacterController` (gameplay token) intentionally share a name across packages (mirrors `RigidBody`); `computeMovement(collider, desired): Vec2`, `move(delta): Vec2`, `createCharacterController(options?)`, `CharacterControllerRef.controller`, `CharacterController2D.{offset,slide}` used identically across T1–T7.
- **Cross-task greenness:** T1 ships throwing rapier stubs + a full fake so all packages compile before T2/T4 implement them; dist rebuilds are called out where public APIs change.
