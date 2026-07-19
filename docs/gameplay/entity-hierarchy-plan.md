# Entity Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach sub-entities to a parent entity (Unity-style), composing transforms local→world, usable at the scene level, from scripts, and by a future editor.

**Architecture:** A generic parent/child *relationship* primitive lives in `@atlasjs/nexus` (`Parent`/`Children` components + `world.setParent/getParent/getChildren`, transform-agnostic). `@atlasjs/gameplay` layers *transform composition* on top: `Transform2D` becomes the local transform, a derived `WorldTransform2D` (a `Mat3`) is computed each frame by a `TransformPropagationSystem`, and the existing consumers (sprite render, physics push) read the world transform. `@atlasjs/math` gains the `Mat3` operations the composition needs. The nebula `SceneGraph` stays flat.

**Tech Stack:** TypeScript (strict), pnpm + Turborepo monorepo, vitest, tsdown. Packages: `@atlasjs/nexus`, `@atlasjs/math`, `@atlasjs/gameplay`, `apps/sandbox`.

**Design doc:** `docs/gameplay/entity-hierarchy.md` (read it first).

## Global Constraints

- **Always type the code**, even trivially (function params, variables, class fields). Copied from root `CLAUDE.md`.
- **Do not add comments.** Copied from root `CLAUDE.md`.
- **Avoid circular dependencies** between packages and modules.
- **Backend-agnostic core / loose coupling:** nexus stays a pure ECS (no transform/2D notion in the hierarchy primitive). Transform composition lives only in gameplay.
- **Rebuild a dependency's `dist` after changing its public API** before a downstream package typechecks/tests against it (gameplay resolves `@atlasjs/nexus` and `@atlasjs/math` from their `dist`). Copied from `packages/gameplay/CLAUDE.md`.
- **Typecheck with `tsc --noEmit`**, never `tsc -b` (it emits artifacts next to sources). Copied from `packages/gameplay/CLAUDE.md`.
- **Do NOT commit automatically beyond the per-task commits in this plan; never run any extra commit.** The per-task commits below are the intended granularity.
- **Scheduler is the single ordering authority.** New per-frame work is a step registered via `registerSystem(lane, world, system, { stage })`; keep the `StepHandle` for teardown. Copied from `packages/core/CLAUDE.md`.

---

## File Structure

**`@atlasjs/nexus`**
- Create `packages/nexus/src/hierarchy/Parent.ts` — `Parent { value: Entity }`.
- Create `packages/nexus/src/hierarchy/Children.ts` — `Children { value: Entity[] }`.
- Create `packages/nexus/src/hierarchy/index.ts` — barrel.
- Modify `packages/nexus/src/index.ts` — export `./hierarchy`.
- Modify `packages/nexus/src/world/NexusWorld.ts` — `setParent`/`getParent`/`getChildren`, recursive `destroyEntity`, private `detachFromParent`/`isAncestorOf`.
- Modify `packages/nexus/src/command/CommandBuffer.ts` — `setParent` on `CommandBuffer`, `CommandTarget`, `NexusCommandBuffer`.
- Create `packages/nexus/test/hierarchy.test.ts`.

**`@atlasjs/math`**
- Modify `packages/math/src/Mat3.ts` — `multiply`, static `multiply`, `invert`, `getTranslation`, `getRotation`, `getScale`; widen `fromTransform2D` to a structural `Transform2DValues`.
- Create `packages/math/vitest.config.ts`.
- Modify `packages/math/package.json` — add `"test": "vitest run"`.
- Create `packages/math/test/mat3.test.ts`.

**`@atlasjs/gameplay`**
- Create `packages/gameplay/src/components/WorldTransform2D.ts`.
- Modify `packages/gameplay/src/components/index.ts` — export it.
- Create `packages/gameplay/src/systems/TransformPropagationSystem.ts`.
- Modify `packages/gameplay/src/systems/index.ts` — export it.
- Modify `packages/gameplay/src/GameplayPlugin.ts` — define `WorldTransform2D`, register the system in `update`/`Late`.
- Modify `packages/gameplay/src/systems/SpriteRenderSystem.ts` — read `WorldTransform2D`.
- Modify `packages/gameplay/src/systems/PhysicsPushSystem.ts` — place bodies from world transform for parented entities.
- Modify `packages/gameplay/src/systems/PhysicsPullSystem.ts` — restrict writeback to `dynamic`.
- Modify `packages/gameplay/src/scripting/components/Transform2DComponent.ts` — `setParent`/`parent`/`getChildren`.
- Create `packages/gameplay/test/transform-hierarchy.test.ts`.
- Create `packages/gameplay/test/transform-hierarchy-integration.test.ts`.
- Create `packages/gameplay/test/transform-parent-facade.test.ts`.
- Modify `packages/gameplay/test/sprite-render-system.test.ts` — entities carry `WorldTransform2D`.

**`apps/sandbox`**
- Modify `apps/sandbox/src/game/EcsScene.ts` — native scene-level attach demo.

**docs**
- Modify `docs/backlog.md` — deferred items.
- Modify `docs/gameplay/entity-hierarchy.md` — mark implemented.

---

## Task 1: Nexus parent/child relationship primitive

> **Status: ✅ implemented + reviewed clean (awaiting user commit).** 9/9 hierarchy tests + 65/65 nexus suite green; nexus dist rebuilt. Minor findings deferred to final review (see ledger).

**Files:**
- Create: `packages/nexus/src/hierarchy/Parent.ts`, `packages/nexus/src/hierarchy/Children.ts`, `packages/nexus/src/hierarchy/index.ts`
- Modify: `packages/nexus/src/index.ts`, `packages/nexus/src/world/NexusWorld.ts`, `packages/nexus/src/command/CommandBuffer.ts`
- Test: `packages/nexus/test/hierarchy.test.ts`

**Interfaces:**
- Produces:
  - `class Parent { value: Entity }` (ctor `(value: Entity)`)
  - `class Children { value: Entity[] }` (ctor `()`, starts `[]`)
  - `NexusWorld.setParent(child: Entity, parent: Entity | null): void`
  - `NexusWorld.getParent(child: Entity): Entity | undefined`
  - `NexusWorld.getChildren(entity: Entity): ReadonlyArray<Entity>`
  - `CommandBuffer.setParent(child: Entity, parent: Entity | null): void`
- Consumes: existing `NexusWorld` (`addComponent`/`getComponent`/`removeComponent`/`hasComponent`/`destroyEntity`/`exists`).

- [ ] **Step 1: Write the failing test**

Create `packages/nexus/test/hierarchy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/world";
import { Entity } from "../src/types";
import { Parent, Children } from "../src/hierarchy";

describe("NexusWorld hierarchy", () => {
  it("setParent links child to parent (both sides)", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);

    expect(world.getParent(child)).toBe(parent);
    expect([...world.getChildren(parent)]).toEqual([child]);
    expect(world.getComponent(child, Parent)!.value).toBe(parent);
    expect(world.getComponent(parent, Children)!.value).toEqual([child]);
  });

  it("getChildren returns empty for a childless entity", () => {
    const world: NexusWorld = new NexusWorld();
    const e: Entity = world.createEntity();
    expect(world.getChildren(e).length).toBe(0);
  });

  it("reparenting moves the child between parents", () => {
    const world: NexusWorld = new NexusWorld();
    const a: Entity = world.createEntity();
    const b: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, a);
    world.setParent(child, b);

    expect(world.getParent(child)).toBe(b);
    expect([...world.getChildren(a)]).toEqual([]);
    expect([...world.getChildren(b)]).toEqual([child]);
  });

  it("setParent(child, null) detaches", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);
    world.setParent(child, null);

    expect(world.getParent(child)).toBeUndefined();
    expect([...world.getChildren(parent)]).toEqual([]);
  });

  it("throws on self-parenting", () => {
    const world: NexusWorld = new NexusWorld();
    const e: Entity = world.createEntity();
    expect(() => world.setParent(e, e)).toThrow();
  });

  it("throws when it would create a cycle", () => {
    const world: NexusWorld = new NexusWorld();
    const a: Entity = world.createEntity();
    const b: Entity = world.createEntity();

    world.setParent(b, a);
    expect(() => world.setParent(a, b)).toThrow();
  });

  it("destroyEntity destroys descendants recursively", () => {
    const world: NexusWorld = new NexusWorld();
    const root: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    const grandchild: Entity = world.createEntity();

    world.setParent(child, root);
    world.setParent(grandchild, child);

    world.destroyEntity(root);

    expect(world.exists(root)).toBe(false);
    expect(world.exists(child)).toBe(false);
    expect(world.exists(grandchild)).toBe(false);
  });

  it("destroying a child detaches it from its parent's Children", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.setParent(child, parent);
    world.destroyEntity(child);

    expect([...world.getChildren(parent)]).toEqual([]);
  });

  it("world.commands.setParent applies on flush", () => {
    const world: NexusWorld = new NexusWorld();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();

    world.commands.setParent(child, parent);
    expect(world.getParent(child)).toBeUndefined();

    world.flush();
    expect(world.getParent(child)).toBe(parent);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nexus exec vitest run test/hierarchy.test.ts`
Expected: FAIL — `Parent`/`Children` not exported, `world.setParent` is not a function.

- [ ] **Step 3: Create the components**

Create `packages/nexus/src/hierarchy/Parent.ts`:

```ts
import { Entity } from "../types";

export class Parent {
  public value: Entity;

  public constructor(value: Entity) {
    this.value = value;
  }
}
```

Create `packages/nexus/src/hierarchy/Children.ts`:

```ts
import { Entity } from "../types";

export class Children {
  public value: Entity[];

  public constructor() {
    this.value = [];
  }
}
```

Create `packages/nexus/src/hierarchy/index.ts`:

```ts
export * from "./Parent";
export * from "./Children";
```

- [ ] **Step 4: Export the barrel from the package index**

In `packages/nexus/src/index.ts`, add the export (after `export * from "./entity";`):

```ts
export * from "./hierarchy";
```

- [ ] **Step 5: Add the world API and recursive destroy**

In `packages/nexus/src/world/NexusWorld.ts`, add the `Parent`/`Children` import to the existing imports:

```ts
import { Parent, Children } from "../hierarchy";
```

Add a module-level constant just after the imports (before the class):

```ts
const EMPTY_CHILDREN: ReadonlyArray<Entity> = [];
```

Add these methods to the `NexusWorld` class (place them right after `createEntity`):

```ts
public getParent(child: Entity): Entity | undefined {
  return this.getComponent(child, Parent)?.value;
}

public getChildren(entity: Entity): ReadonlyArray<Entity> {
  const children: Children | undefined = this.getComponent(entity, Children);
  return children !== undefined ? children.value : EMPTY_CHILDREN;
}

public setParent(child: Entity, parent: Entity | null): void {
  this.assertEntityExists(child);

  const currentParent: Entity | undefined = this.getParent(child);

  if (parent === null) {
    if (currentParent !== undefined) {
      this.detachFromParent(child, currentParent);
      this.removeComponent(child, Parent);
    }
    return;
  }

  this.assertEntityExists(parent);

  if (parent === child) {
    throw new Error(`Cannot parent entity ${child} to itself.`);
  }

  if (currentParent === parent) {
    return;
  }

  if (this.isAncestorOf(child, parent)) {
    throw new Error(
      `Cannot parent entity ${child} to ${parent}: it would create a cycle.`,
    );
  }

  if (currentParent !== undefined) {
    this.detachFromParent(child, currentParent);
  }

  const link: Parent | undefined = this.getComponent(child, Parent);
  if (link !== undefined) {
    link.value = parent;
  } else {
    this.addComponent(child, Parent, parent);
  }

  const siblings: Children =
    this.getComponent(parent, Children) ?? this.addComponent(parent, Children);
  siblings.value.push(child);
}

private detachFromParent(child: Entity, parent: Entity): void {
  const children: Children | undefined = this.getComponent(parent, Children);
  if (children === undefined) {
    return;
  }
  const index: number = children.value.indexOf(child);
  if (index !== -1) {
    children.value.splice(index, 1);
  }
}

private isAncestorOf(ancestor: Entity, entity: Entity): boolean {
  let current: Entity | undefined = this.getParent(entity);
  while (current !== undefined) {
    if (current === ancestor) {
      return true;
    }
    current = this.getParent(current);
  }
  return false;
}
```

Replace the existing `destroyEntity` body with the recursive version:

```ts
public destroyEntity(entity: Entity): boolean {
  this.assertEntityExists(entity);

  const children: ReadonlyArray<Entity> = this.getChildren(entity);
  const snapshot: Entity[] = [...children];
  for (let i: number = 0; i < snapshot.length; i++) {
    if (this.entityManager.has(snapshot[i])) {
      this.destroyEntity(snapshot[i]);
    }
  }

  const parent: Entity | undefined = this.getParent(entity);
  if (parent !== undefined && this.entityManager.has(parent)) {
    this.detachFromParent(entity, parent);
  }

  for (const [id, store] of this.stores) {
    const instance: unknown = store.get(entity);

    if (store.delete(entity)) {
      this.emit(this.removeListeners, id, entity, instance as object);
    }
  }

  return this.entityManager.destroy(entity);
}
```

- [ ] **Step 6: Add setParent to the command buffer**

In `packages/nexus/src/command/CommandBuffer.ts`:

Add to the `CommandBuffer` interface (after `remove`):

```ts
setParent(child: Entity, parent: Entity | null): void;
```

Add to the `CommandTarget` interface (after `removeComponent`):

```ts
setParent(child: Entity, parent: Entity | null): void;
```

Add this method to `NexusCommandBuffer` (after `remove`):

```ts
public setParent(child: Entity, parent: Entity | null): void {
  this.queue.push(() => {
    if (!this.world.exists(child)) {
      return;
    }
    if (parent !== null && !this.world.exists(parent)) {
      return;
    }
    this.world.setParent(child, parent);
  });
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/nexus exec vitest run test/hierarchy.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Run the full nexus suite (no regressions)**

Run: `pnpm --filter @atlasjs/nexus test`
Expected: PASS (all existing suites + hierarchy).

- [ ] **Step 9: Build the nexus dist (downstream packages resolve from it)**

Run: `pnpm --filter @atlasjs/nexus build`
Expected: tsdown completes, no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/nexus/src/hierarchy packages/nexus/src/index.ts packages/nexus/src/world/NexusWorld.ts packages/nexus/src/command/CommandBuffer.ts packages/nexus/test/hierarchy.test.ts
git commit -m "feat(nexus): parent/child relationship primitive + recursive destroy"
```

---

## Task 2: Mat3 affine operations

> **Status: ✅ implemented + reviewed clean (awaiting user commit).** 4/4 mat3 tests green (multiply/invert/decompose hand-verified by reviewer), `tsc --noEmit` clean, math dist rebuilt. Minor: implementer's report mis-cited the non-breaking rationale (code is fine).

**Files:**
- Modify: `packages/math/src/Mat3.ts`
- Create: `packages/math/vitest.config.ts`, `packages/math/test/mat3.test.ts`
- Modify: `packages/math/package.json`

**Interfaces:**
- Produces (on `Mat3`):
  - `multiply(b: Mat3): Mat3` (mutates `this = this * b`, returns `this`)
  - `static multiply(a: Mat3, b: Mat3): Mat3`
  - `invert(): Mat3` (mutates `this`, returns `this`; identity if singular)
  - `getTranslation(out?: Vec2): Vec2`
  - `getRotation(): number`
  - `getScale(out?: Vec2): Vec2`
  - `fromTransform2D(t: Transform2DValues): Mat3` (widened param — accepts anything with `position: Vec2Like`, `rotation: number`, `scale: Vec2Like`)
  - `interface Transform2DValues`
- Consumes: existing `Mat3` buffer layout (column-major `[c0x,c0y,c0z, c1x,c1y,c1z, c2x,c2y,c2z]`), `Vec2`, `Vec2Like`.

- [ ] **Step 1: Add the math test script and config**

In `packages/math/package.json`, add a `test` script inside `"scripts"` (after `"dev"`):

```json
    "test": "vitest run",
```

Create `packages/math/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `packages/math/test/mat3.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { Mat3 } from "../src/Mat3";
import { Transform2D } from "../src/Transform2D";
import { Vec2 } from "../src/Vec2";

describe("Mat3", () => {
  it("multiply composes transforms (parent * local) on a point", () => {
    const translate: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(10, 0)));
    const scale: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(0, 0), new Vec2(2, 2)),
    );

    const composed: Mat3 = translate.clone().multiply(scale);
    const p: Vec2 = composed.transformPoint2(1, 0);

    expect(p.x).toBeCloseTo(12, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("static multiply does not mutate its operands", () => {
    const a: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(3, 4)));
    const b: Mat3 = Mat3.identity();

    Mat3.multiply(a, b);

    expect(a.getTranslation().x).toBeCloseTo(3, 6);
    expect(a.getTranslation().y).toBeCloseTo(4, 6);
  });

  it("invert yields identity when composed with the original", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(5, -3), new Vec2(2, 4), 0.7),
    );
    const id: Mat3 = m.clone().multiply(m.clone().invert());

    expect(id.buffer[0]).toBeCloseTo(1, 5);
    expect(id.buffer[4]).toBeCloseTo(1, 5);
    expect(id.buffer[8]).toBeCloseTo(1, 5);
    expect(id.buffer[1]).toBeCloseTo(0, 5);
    expect(id.buffer[3]).toBeCloseTo(0, 5);
    expect(id.buffer[6]).toBeCloseTo(0, 5);
    expect(id.buffer[7]).toBeCloseTo(0, 5);
  });

  it("decomposes translation, rotation and scale (no shear)", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(7, 9), new Vec2(3, 2), 0.5),
    );

    expect(m.getTranslation().x).toBeCloseTo(7, 6);
    expect(m.getTranslation().y).toBeCloseTo(9, 6);
    expect(m.getRotation()).toBeCloseTo(0.5, 6);
    expect(m.getScale().x).toBeCloseTo(3, 6);
    expect(m.getScale().y).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/math exec vitest run test/mat3.test.ts`
Expected: FAIL — `multiply`/`invert`/`getTranslation`/`getRotation`/`getScale` are not functions.

- [ ] **Step 4: Implement the Mat3 operations**

In `packages/math/src/Mat3.ts`, replace the top import block:

```ts
import { Transform2D } from "./Transform2D";
import { Vec2 } from "./Vec2";
```

with:

```ts
import { Vec2 } from "./Vec2";
import { Vec2Like } from "./Vec2Like";

export interface Transform2DValues {
  position: Vec2Like;
  rotation: number;
  scale: Vec2Like;
}
```

Change both `fromTransform2D` signatures' parameter type from `t: Transform2D` to `t: Transform2DValues` (instance method at line ~45 and static at line ~83). The bodies stay identical.

Add these methods to the class (before the `static identity()`):

```ts
public multiply(b: Mat3): Mat3 {
  const a: Float32Array = this.buffer;
  const o: Float32Array = b.buffer;

  const a0: number = a[0], a1: number = a[1], a2: number = a[2];
  const a3: number = a[3], a4: number = a[4], a5: number = a[5];
  const a6: number = a[6], a7: number = a[7], a8: number = a[8];

  const b0: number = o[0], b1: number = o[1], b2: number = o[2];
  const b3: number = o[3], b4: number = o[4], b5: number = o[5];
  const b6: number = o[6], b7: number = o[7], b8: number = o[8];

  a[0] = a0 * b0 + a3 * b1 + a6 * b2;
  a[1] = a1 * b0 + a4 * b1 + a7 * b2;
  a[2] = a2 * b0 + a5 * b1 + a8 * b2;

  a[3] = a0 * b3 + a3 * b4 + a6 * b5;
  a[4] = a1 * b3 + a4 * b4 + a7 * b5;
  a[5] = a2 * b3 + a5 * b4 + a8 * b5;

  a[6] = a0 * b6 + a3 * b7 + a6 * b8;
  a[7] = a1 * b6 + a4 * b7 + a7 * b8;
  a[8] = a2 * b6 + a5 * b7 + a8 * b8;

  return this;
}

public invert(): Mat3 {
  const m: Float32Array = this.buffer;

  const a: number = m[0], b: number = m[3], c: number = m[6];
  const d: number = m[1], e: number = m[4], f: number = m[7];
  const g: number = m[2], h: number = m[5], i: number = m[8];

  const A: number = e * i - f * h;
  const B: number = f * g - d * i;
  const C: number = d * h - e * g;

  const det: number = a * A + b * B + c * C;

  if (det === 0) {
    return this.identity();
  }

  const invDet: number = 1 / det;

  m[0] = A * invDet;
  m[1] = B * invDet;
  m[2] = C * invDet;
  m[3] = (c * h - b * i) * invDet;
  m[4] = (a * i - c * g) * invDet;
  m[5] = (b * g - a * h) * invDet;
  m[6] = (b * f - c * e) * invDet;
  m[7] = (c * d - a * f) * invDet;
  m[8] = (a * e - b * d) * invDet;

  return this;
}

public getTranslation(out: Vec2 = new Vec2()): Vec2 {
  const m: Float32Array = this.buffer;
  return out.set(m[6], m[7]);
}

public getRotation(): number {
  const m: Float32Array = this.buffer;
  return Math.atan2(m[1], m[0]);
}

public getScale(out: Vec2 = new Vec2()): Vec2 {
  const m: Float32Array = this.buffer;
  const sx: number = Math.hypot(m[0], m[1]);
  const sy: number = Math.hypot(m[3], m[4]);
  return out.set(sx, sy);
}

public static multiply(a: Mat3, b: Mat3): Mat3 {
  return a.clone().multiply(b);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/math exec vitest run test/mat3.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify no existing Mat3 caller broke, then build the dist**

Run: `pnpm --filter @atlasjs/math exec tsc --noEmit`
Expected: no type errors (widening `fromTransform2D` is non-breaking; `Transform2D` still satisfies `Transform2DValues`).

Run: `pnpm --filter @atlasjs/math build`
Expected: tsdown completes, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/math/src/Mat3.ts packages/math/vitest.config.ts packages/math/test/mat3.test.ts packages/math/package.json
git commit -m "feat(math): Mat3 multiply/invert/decompose + structural fromTransform2D"
```

---

## Task 3: WorldTransform2D + TransformPropagationSystem

**Files:**
- Create: `packages/gameplay/src/components/WorldTransform2D.ts`, `packages/gameplay/src/systems/TransformPropagationSystem.ts`
- Modify: `packages/gameplay/src/components/index.ts`, `packages/gameplay/src/systems/index.ts`, `packages/gameplay/src/GameplayPlugin.ts`
- Test: `packages/gameplay/test/transform-hierarchy.test.ts`

**Interfaces:**
- Consumes: `@atlasjs/nexus` (`world.getChildren`, `world.setParent`, `Parent`), `@atlasjs/math` (`Mat3`, `Vec2`), gameplay `Transform2D`, `RigidBody2D`.
- Produces:
  - `class WorldTransform2D { readonly matrix: Mat3; getPosition(out?: Vec2): Vec2; getRotation(): number; getScale(out?: Vec2): Vec2 }`
  - `class TransformPropagationSystem implements NexusSystem` with `update(ctx: NexusSystemContext): void`.
  - Propagation rule per entity with `Transform2D`: dynamic (`RigidBody2D.type === "dynamic"`) or root → `world = fromTransform2D(local)`; otherwise `world = parentWorld * fromTransform2D(local)`. Entities without `Transform2D` pass the ancestor world through.

- [ ] **Step 1: Write the failing test**

Create `packages/gameplay/test/transform-hierarchy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { NexusWorld, Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { TransformPropagationSystem } from "../src/systems";

function setup(): { world: NexusWorld; system: TransformPropagationSystem } {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(Transform2D)
    .defineComponent(WorldTransform2D)
    .defineComponent(RigidBody2D);
  return { world, system: new TransformPropagationSystem() };
}

describe("TransformPropagationSystem", () => {
  it("root world transform equals its local transform", () => {
    const { world, system } = setup();
    const e: Entity = world.createEntity();
    world.addComponent(e, Transform2D).position.set(5, 7);

    system.update({ world, dt: 0 });

    const w: WorldTransform2D = world.requireComponent(e, WorldTransform2D);
    expect(w.getPosition().x).toBeCloseTo(5, 6);
    expect(w.getPosition().y).toBeCloseTo(7, 6);
  });

  it("child world position is offset by the parent position", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).position.set(10, 0);
    world.addComponent(child, Transform2D).position.set(5, 0);
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(15, 6);
  });

  it("child inherits parent scale", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).scale.set(2, 2);
    world.addComponent(child, Transform2D).position.set(5, 0);
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(10, 6);
  });

  it("a dynamic body ignores parent composition", () => {
    const { world, system } = setup();
    const parent: Entity = world.createEntity();
    const child: Entity = world.createEntity();
    world.addComponent(parent, Transform2D).position.set(10, 0);
    world.addComponent(child, Transform2D).position.set(5, 0);
    const body: RigidBody2D = world.addComponent(child, RigidBody2D);
    body.type = "dynamic";
    world.setParent(child, parent);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(child, WorldTransform2D).getPosition().x).toBeCloseTo(5, 6);
  });

  it("composes down a three-level chain (parent before child)", () => {
    const { world, system } = setup();
    const gp: Entity = world.createEntity();
    const p: Entity = world.createEntity();
    const c: Entity = world.createEntity();
    world.addComponent(gp, Transform2D).position.set(1, 0);
    world.addComponent(p, Transform2D).position.set(2, 0);
    world.addComponent(c, Transform2D).position.set(3, 0);
    world.setParent(p, gp);
    world.setParent(c, p);

    system.update({ world, dt: 0 });

    expect(world.requireComponent(c, WorldTransform2D).getPosition().x).toBeCloseTo(6, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-hierarchy.test.ts`
Expected: FAIL — `WorldTransform2D` / `TransformPropagationSystem` not exported.

- [ ] **Step 3: Create the WorldTransform2D component**

Create `packages/gameplay/src/components/WorldTransform2D.ts`:

```ts
import { Mat3, Vec2 } from "@atlasjs/math";

export class WorldTransform2D {
  public readonly matrix: Mat3;

  public constructor() {
    this.matrix = Mat3.identity();
  }

  public getPosition(out?: Vec2): Vec2 {
    return this.matrix.getTranslation(out);
  }

  public getRotation(): number {
    return this.matrix.getRotation();
  }

  public getScale(out?: Vec2): Vec2 {
    return this.matrix.getScale(out);
  }
}
```

In `packages/gameplay/src/components/index.ts`, add:

```ts
export * from "./WorldTransform2D";
```

- [ ] **Step 4: Create the propagation system**

Create `packages/gameplay/src/systems/TransformPropagationSystem.ts`:

```ts
import { Mat3 } from "@atlasjs/math";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
  Parent,
} from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../components";

export class TransformPropagationSystem implements NexusSystem {
  private readonly localScratch: Mat3;

  public constructor() {
    this.localScratch = Mat3.identity();
  }

  public update({ world }: NexusSystemContext): void {
    this.ensureWorldTransforms(world);

    const roots: Entity[] = world.query(Transform2D).without(Parent).getEntities();

    for (let i: number = 0; i < roots.length; i++) {
      this.propagate(world, roots[i], null);
    }
  }

  private ensureWorldTransforms(world: NexusWorld): void {
    const missing: Entity[] = world
      .query(Transform2D)
      .without(WorldTransform2D)
      .getEntities();

    for (let i: number = 0; i < missing.length; i++) {
      world.addComponent(missing[i], WorldTransform2D);
    }
  }

  private propagate(
    world: NexusWorld,
    entity: Entity,
    parentWorld: Mat3 | null,
  ): void {
    const transform: Transform2D | undefined = world.getComponent(entity, Transform2D);

    let currentWorld: Mat3 | null = parentWorld;

    if (transform !== undefined) {
      const wt: WorldTransform2D = world.requireComponent(entity, WorldTransform2D);
      const rigidBody: RigidBody2D | undefined = world.getComponent(entity, RigidBody2D);
      const isDynamic: boolean =
        rigidBody !== undefined && rigidBody.type === "dynamic";

      this.localScratch.fromTransform2D(transform);

      if (parentWorld === null || isDynamic) {
        wt.matrix.copy(this.localScratch);
      } else {
        wt.matrix.copy(parentWorld).multiply(this.localScratch);
      }

      currentWorld = wt.matrix;
    }

    const children: ReadonlyArray<Entity> = world.getChildren(entity);
    for (let i: number = 0; i < children.length; i++) {
      this.propagate(world, children[i], currentWorld);
    }
  }
}
```

In `packages/gameplay/src/systems/index.ts`, add:

```ts
export * from "./TransformPropagationSystem";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-hierarchy.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Register the system in the gameplay plugin**

In `packages/gameplay/src/GameplayPlugin.ts`:

Add `TransformPropagationSystem` to the systems import block:

```ts
import {
  AnimatorSystem,
  PhysicsPullSystem,
  PhysicsPushSystem,
  PlayerInputSystem,
  SpriteRenderSystem,
  TransformPropagationSystem,
} from "./systems";
```

Add `WorldTransform2D` to the components import block:

```ts
import {
  Animator,
  PhysicsBodyRef,
  PlayerInput,
  RigidBody2D,
  SpriteRender,
  Transform2D,
  WorldTransform2D,
} from "./components";
```

Instantiate it alongside the other systems (after `animatorSystem`):

```ts
const transformPropagationSystem: TransformPropagationSystem = new TransformPropagationSystem();
```

Add it to the `defineComponent` chain (after `.defineComponent(Transform2D)`):

```ts
.defineComponent(WorldTransform2D)
```

Register it in the `update` lane at the `Late` stage (add a new `this.handles.push(...)` after the animator registration):

```ts
this.handles.push(
  registerSystem(update, world, transformPropagationSystem, {
    name: "gameplay:transform-propagation",
    stage: "Late",
  }),
);
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/gameplay/src/components packages/gameplay/src/systems packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/transform-hierarchy.test.ts
git commit -m "feat(gameplay): WorldTransform2D + TransformPropagationSystem"
```

---

## Task 4: Wire consumers to the world transform

**Files:**
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts`, `packages/gameplay/src/systems/PhysicsPushSystem.ts`, `packages/gameplay/src/systems/PhysicsPullSystem.ts`
- Modify (existing test): `packages/gameplay/test/sprite-render-system.test.ts`
- Test: `packages/gameplay/test/transform-hierarchy-integration.test.ts`

**Interfaces:**
- Consumes: `WorldTransform2D` (Task 3), `world.getParent` (Task 1).
- Produces (behavior): `SpriteRenderSystem` positions nodes from `WorldTransform2D`. `PhysicsPushSystem` places a body from `WorldTransform2D` when the entity has a parent, else from `Transform2D`. `PhysicsPullSystem` writes back only for `dynamic` bodies.

- [ ] **Step 1: Write the failing integration test**

Create `packages/gameplay/test/transform-hierarchy-integration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

describe("Gameplay — transform hierarchy integration", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("a parented child composes its world transform through the scheduler", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D).position.set(100, 0);
    h.world.addComponent(child, Transform2D).position.set(20, 0);
    h.world.setParent(child, parent);

    h.frame();

    const w: WorldTransform2D = h.world.requireComponent(child, WorldTransform2D);
    expect(w.getPosition().x).toBeCloseTo(120, 4);
  });

  it("a kinematic child's local transform is not corrupted by physics writeback", () => {
    const parent: Entity = h.world.createEntity();
    const child: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D).position.set(100, 0);

    h.world.addComponent(child, Transform2D).position.set(20, 0);
    const body: RigidBody2D = h.world.addComponent(child, RigidBody2D);
    body.type = "kinematic";
    h.world.setParent(child, parent);

    h.frame();
    h.frame();

    const local: Transform2D = h.world.requireComponent(child, Transform2D);
    expect(local.position.x).toBeCloseTo(20, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-hierarchy-integration.test.ts`
Expected: FAIL on the second case — `PhysicsPullSystem` currently writes the kinematic body's world translation (120) back into the child's local `Transform2D`, so `local.position.x` is 120, not 20.

- [ ] **Step 3: Restrict physics writeback to dynamic bodies**

Replace the body of `packages/gameplay/src/systems/PhysicsPullSystem.ts` `update` with:

```ts
// prettier-ignore
public update({ world }: NexusSystemContext): void {
  world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((_, rigidBody, transform, ref) => {
    if (rigidBody.type !== "dynamic") {
      return;
    }

    const body: RigidBody = ref.body;

    transform.position.copyFrom(body.getTranslation());
    transform.rotation = body.getRotation();

    rigidBody.velocity.copyFrom(body.getLinearVelocity());
    rigidBody.angularVelocity = body.getAngularVelocity();
  });
}
```

- [ ] **Step 4: Place parented bodies from the world transform in PhysicsPushSystem**

In `packages/gameplay/src/systems/PhysicsPushSystem.ts`:

Update the imports to add `Vec2` and `WorldTransform2D` and `NexusWorld`:

```ts
import { PhysicsWorld, RigidBody } from "@atlasjs/inertia";
import { Vec2 } from "@atlasjs/math";
import { Entity, NexusSystem, NexusSystemContext, NexusWorld } from "@atlasjs/nexus";

import { PhysicsBodyRef, RigidBody2D, Transform2D, WorldTransform2D } from "../components";
```

Add a scratch field and initialize it in the constructor:

```ts
private readonly positionScratch: Vec2;
```

```ts
public constructor(inertia: PhysicsWorld) {
  this.inertia = inertia;
  this.pending = [];
  this.positionScratch = new Vec2();
}
```

Add a private placement resolver (returns world transform for parented entities, local otherwise):

```ts
private resolvePlacement(
  world: NexusWorld,
  entity: Entity,
  transform: Transform2D,
): { x: number; y: number; rotation: number } {
  if (world.getParent(entity) !== undefined) {
    const wt: WorldTransform2D | undefined = world.getComponent(entity, WorldTransform2D);
    if (wt !== undefined) {
      const p: Vec2 = wt.getPosition(this.positionScratch);
      return { x: p.x, y: p.y, rotation: wt.getRotation() };
    }
  }
  return { x: transform.position.x, y: transform.position.y, rotation: transform.rotation };
}
```

Replace the `update` body with the version that uses it for creation and for the kinematic/static push:

```ts
// prettier-ignore
public update({ world }: NexusSystemContext): void {
  world.query(RigidBody2D, Transform2D).without(PhysicsBodyRef).each((entity) => {
    this.pending.push(entity);
  });

  for (const entity of this.pending) {
    const rigidBody: RigidBody2D = world.requireComponent(entity, RigidBody2D);
    const transform: Transform2D = world.requireComponent(entity, Transform2D);
    const place = this.resolvePlacement(world, entity, transform);
    const body: RigidBody = this.inertia.createRigidBody({
      type: rigidBody.type,
      translation: new Vec2(place.x, place.y),
      rotation: place.rotation,
      linearVelocity: rigidBody.velocity,
      angularVelocity: rigidBody.angularVelocity,
    });

    world.addComponent(entity, PhysicsBodyRef, body);
  }

  this.pending.length = 0;

  world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((entity, rigidBody, transform, ref) => {
    const body: RigidBody = ref.body;

    body.setMass(rigidBody.mass);
    body.setLinearVelocity(rigidBody.velocity.x, rigidBody.velocity.y);
    body.setAngularVelocity(rigidBody.angularVelocity);

    if (rigidBody.type === "kinematic" || rigidBody.type === "static") {
      const place = this.resolvePlacement(world, entity, transform);
      body.setTranslation(place.x, place.y);
      body.setRotation(place.rotation);
    }
  });
}
```

- [ ] **Step 5: Read the world transform in SpriteRenderSystem**

In `packages/gameplay/src/systems/SpriteRenderSystem.ts`:

Two import edits only (leave the `@atlasjs/nebula` and `@atlasjs/nexus` import lines untouched): add a new `Vec2` import line at the top, and change the existing `../components` line from `{ SpriteRender, Transform2D }` to `{ SpriteRender, WorldTransform2D }`. After the edit the first import lines read:

```ts
import { Vec2 } from "@atlasjs/math";
import { Sprite } from "../assets";
import { SpriteRender, WorldTransform2D } from "../components";
import {
  Color,
  NebulaRenderer,
  Sampler,
  SpriteNode,
} from "@atlasjs/nebula";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";
```

Add scratch fields and initialize them in the constructor:

```ts
private readonly positionScratch: Vec2;
private readonly scaleScratch: Vec2;
```

```ts
public constructor(nebula: NebulaRenderer) {
  this.mounted = new SparseSet<MountedSprite>();
  this.nebula = nebula;
  this.positionScratch = new Vec2();
  this.scaleScratch = new Vec2();
  this.sampler = nebula.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });
}
```

Replace the `update` body:

```ts
// prettier-ignore
public update({ world }: NexusSystemContext): void {
  world.query(WorldTransform2D, SpriteRender).each((entity, worldTransform, spriteRender) => {
    const node: SpriteNode = this.resolveNode(entity, spriteRender.sprite);

    const position: Vec2 = worldTransform.getPosition(this.positionScratch);
    const rotation: number = worldTransform.getRotation();
    const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

    const scaleX: number = scale.x * (spriteRender.flipX ? -1 : 1);
    const scaleY: number = scale.y * (spriteRender.flipY ? -1 : 1);
    const color: Color = spriteRender.color;

    node
      .setPosition(position.x, position.y)
      .setRotation(rotation)
      .setScale(scaleX, scaleY)
      .setTint(color.r, color.g, color.b, color.a)
      .setVisible(spriteRender.visible)
      .setZIndex(spriteRender.sortingOrder);
  });
}
```

- [ ] **Step 6: Update the SpriteRenderSystem unit test to carry WorldTransform2D**

The unit test drives `SpriteRenderSystem` in isolation (no propagation runs), so entities must carry `WorldTransform2D` directly. Replace the whole file `packages/gameplay/test/sprite-render-system.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import {
  Color,
  NebulaRenderer,
  Sampler,
  SceneGraph,
  SpriteNode,
} from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender, WorldTransform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { fakeTexture } from "./helpers/fakes";

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: SpriteRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(SpriteRender);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new SpriteRenderSystem(nebula) };
}

function mount(
  world: NexusWorld,
  sprite: Sprite,
  transform: Transform2D = new Transform2D(),
): Entity {
  const entity: Entity = world.createEntity();
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  world.addComponent(entity, SpriteRender, sprite);
  return entity;
}

function children(scene: SceneGraph): ReadonlyArray<SpriteNode> {
  return scene.root.getChildren() as ReadonlyArray<SpriteNode>;
}

describe("SpriteRenderSystem", () => {
  it("mounts one scene node per SpriteRender entity", () => {
    const { world, scene, system } = setup();
    mount(world, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
  });

  it("positions the node at the world transform", () => {
    const { world, scene, system } = setup();
    mount(world, new Sprite(fakeTexture()), new Transform2D(new Vec2(15, 4)));

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.position.x).toBeCloseTo(15, 4);
    expect(node.transform.position.y).toBeCloseTo(4, 4);
  });

  it("applies flip as the sign of the world scale", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(), new Vec2(3, 2)),
    );
    world.requireComponent(entity, SpriteRender).flipX = true;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.scale.x).toBeCloseTo(-3, 4);
    expect(node.transform.scale.y).toBeCloseTo(2, 4);
  });

  it("propagates tint, visibility and sorting order", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture()));

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    render.color = Color.Red();
    render.visible = false;
    render.sortingOrder = 4;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.tint.x).toBe(1);
    expect(node.tint.y).toBe(0);
    expect(node.visible).toBe(false);
    expect(node.zIndex).toBe(4);
  });

  it("reuses the node on a same-texture rect swap", () => {
    const { world, scene, system } = setup();
    const texture = fakeTexture("shared", 64, 64);
    const entity: Entity = mount(world, new Sprite(texture));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(texture, {
      rect: new Bound(0, 0, 16, 16),
    });
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).toBe(first);
    expect(first.getSourceRect().width).toBe(16);
  });

  it("rebuilds the node on a different-texture swap", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture("a")));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(fakeTexture("b"));
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).not.toBe(first);
  });

  it("unmount removes the node from the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });
    expect(children(scene).length).toBe(1);

    system.unmount(entity);
    expect(children(scene).length).toBe(0);
  });
});
```

- [ ] **Step 7: Run the changed and new tests**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-hierarchy-integration.test.ts test/sprite-render-system.test.ts`
Expected: PASS (2 + 7 tests).

- [ ] **Step 8: Run the full gameplay suite (no regressions)**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS. Two reasons the harness sprite suites (`sprite-render.test.ts`, `sprite-render-lifecycle.test.ts`) stay green: (a) they already pair `Transform2D` with `SpriteRender` (the *old* query required `Transform2D`), so propagation — now registered — creates a `WorldTransform2D` for each and the new query matches; (b) `physics-bridge.test.ts` entities are kinematic/dynamic *roots*, so `resolvePlacement` uses `Transform2D` (no lag) and the dynamic-only pull leaves kinematic transforms authoritative.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/gameplay/src/systems packages/gameplay/test/transform-hierarchy-integration.test.ts packages/gameplay/test/sprite-render-system.test.ts
git commit -m "feat(gameplay): sprite render + physics push read WorldTransform2D; pull restricted to dynamic"
```

---

## Task 5: Script façade — Transform2DComponent.setParent

**Files:**
- Modify: `packages/gameplay/src/scripting/components/Transform2DComponent.ts`
- Test: `packages/gameplay/test/transform-parent-facade.test.ts`

**Interfaces:**
- Consumes: `world.setParent`/`getParent`/`getChildren`/`hasComponent` (Task 1), `WorldTransform2D` (Task 3), `Mat3` (Task 2), existing `Transform2DComponent` (`resolve()`, protected `world`/`entity`).
- Produces (on `Transform2DComponent`):
  - `setParent(parent: Transform2DComponent | null, worldPositionStays?: boolean): this` (default `true`)
  - `get parent(): Transform2DComponent | null`
  - `getChildren(): Transform2DComponent[]`

- [ ] **Step 1: Write the failing test**

Create `packages/gameplay/test/transform-parent-facade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Vec2, Transform2D as MathTransform2D } from "@atlasjs/math";
import { NexusWorld, Entity } from "@atlasjs/nexus";

import { Transform2D, WorldTransform2D } from "../src/components";
import { Transform2DComponent } from "../src/scripting/components";

function setup(): { world: NexusWorld } {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Transform2D).defineComponent(WorldTransform2D);
  return { world };
}

describe("Transform2DComponent parenting", () => {
  it("setParent links the entities structurally", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    world.addComponent(childE, Transform2D);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent);

    expect(world.getParent(childE)).toBe(parentE);
  });

  it("worldPositionStays recomputes the local transform to keep world position", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();

    world.addComponent(parentE, Transform2D);
    world
      .addComponent(parentE, WorldTransform2D)
      .matrix.fromTransform2D(new MathTransform2D(new Vec2(10, 0)));

    world.addComponent(childE, Transform2D);
    world.addComponent(childE, WorldTransform2D).matrix.identity();

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent, true);

    const local: Transform2D = world.requireComponent(childE, Transform2D);
    expect(local.position.x).toBeCloseTo(-10, 5);
    expect(local.position.y).toBeCloseTo(0, 5);
  });

  it("worldPositionStays=false leaves the local transform untouched", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    const local: Transform2D = world.addComponent(childE, Transform2D);
    local.position.set(5, 0);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);
    child.setParent(parent, false);

    expect(world.requireComponent(childE, Transform2D).position.x).toBe(5);
  });

  it("parent getter and getChildren resolve façades", () => {
    const { world } = setup();
    const parentE: Entity = world.createEntity();
    const childE: Entity = world.createEntity();
    world.addComponent(parentE, Transform2D);
    world.addComponent(childE, Transform2D);
    world.setParent(childE, parentE);

    const child: Transform2DComponent = new Transform2DComponent(world, childE);
    const parent: Transform2DComponent = new Transform2DComponent(world, parentE);

    expect(child.parent).not.toBeNull();
    expect(parent.getChildren().length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-parent-facade.test.ts`
Expected: FAIL — `setParent`/`parent`/`getChildren` do not exist on `Transform2DComponent`.

- [ ] **Step 3: Implement the façade methods**

In `packages/gameplay/src/scripting/components/Transform2DComponent.ts`:

Update the imports:

```ts
import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import {
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../../components";

import { ScriptComponent } from "../core";
```

Add these members inside the `Transform2DComponent` class (after the existing `translate`/`rotate` methods, before the private `controllingBody`):

```ts
public setParent(
  parent: Transform2DComponent | null,
  worldPositionStays: boolean = true,
): this {
  if (!worldPositionStays) {
    this.world.setParent(this.entity, parent !== null ? parent.entity : null);
    return this;
  }

  const currentWorld: Mat3 = this.worldMatrix();

  this.world.setParent(this.entity, parent !== null ? parent.entity : null);

  const parentWorld: Mat3 | null = parent !== null ? parent.worldMatrix() : null;
  const localMatrix: Mat3 =
    parentWorld !== null ? parentWorld.invert().multiply(currentWorld) : currentWorld;

  const transform: Transform2D = this.resolve();
  const position: Vec2 = localMatrix.getTranslation();
  const scale: Vec2 = localMatrix.getScale();
  transform.position.set(position.x, position.y);
  transform.rotation = localMatrix.getRotation();
  transform.scale.set(scale.x, scale.y);

  return this;
}

public get parent(): Transform2DComponent | null {
  const parentEntity: Entity | undefined = this.world.getParent(this.entity);
  return parentEntity !== undefined
    ? new Transform2DComponent(this.world, parentEntity)
    : null;
}

public getChildren(): Transform2DComponent[] {
  const children: ReadonlyArray<Entity> = this.world.getChildren(this.entity);
  const result: Transform2DComponent[] = [];
  for (let i: number = 0; i < children.length; i++) {
    if (this.world.hasComponent(children[i], Transform2D)) {
      result.push(new Transform2DComponent(this.world, children[i]));
    }
  }
  return result;
}

private worldMatrix(): Mat3 {
  const wt: WorldTransform2D | undefined = this.world.getComponent(
    this.entity,
    WorldTransform2D,
  );
  return wt !== undefined ? wt.matrix.clone() : Mat3.fromTransform2D(this.resolve());
}
```

Note: `parentWorld.invert()` mutates the freshly-cloned parent matrix returned by `worldMatrix()`, so it is safe to chain `.multiply(currentWorld)`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/transform-parent-facade.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/gameplay/src/scripting/components/Transform2DComponent.ts packages/gameplay/test/transform-parent-facade.test.ts
git commit -m "feat(gameplay): Transform2DComponent.setParent/parent/getChildren (Unity-style)"
```

---

## Task 6: Sandbox demo + docs

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`
- Modify: `docs/backlog.md`, `docs/gameplay/entity-hierarchy.md`

**Interfaces:**
- Consumes: `nexus.setParent` (Task 1), gameplay `Transform2D`/`SpriteRender` (existing), `WorldTransform2D` propagation (Task 3), sprite render (Task 4).

- [ ] **Step 1: Rebuild upstream dists so the sandbox preview resolves the new APIs**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: tsdown completes (nexus + math were built in Tasks 1–2).

- [ ] **Step 2: Add a native scene-level attach to EcsScene**

In `apps/sandbox/src/game/EcsScene.ts`, extend the gameplay import to include `SpriteRender` and `Transform2D`:

```ts
import {
  type ScriptManager,
  button,
  defineActions,
  Key,
  SCRIPT_MANAGER,
  Sprite,
  SpriteAsset,
  SpriteRender,
  Transform2D,
  vector2,
} from "@atlasjs/gameplay";
```

At the end of `onCreate`, after the two `scriptManager.attach(...)` calls, attach a decorative child entity to the player natively:

```ts
const badge: Entity = nexus.createEntity();
const badgeTransform: Transform2D = nexus.addComponent(badge, Transform2D);
badgeTransform.position.set(0, -60);
badgeTransform.scale.set(0.4, 0.4);
nexus.addComponent(badge, SpriteRender, sealionSprite);
nexus.setParent(badge, player);
```

This creates a child sprite offset above the player and parents it. Because the player is a kinematic root, its `WorldTransform2D` tracks its `Transform2D`, and the propagation composes the badge's world transform each frame — the badge rides along as the player moves.

- [ ] **Step 3: Typecheck the sandbox**

Run: `pnpm --filter @atlasjs/sandbox exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Update the backlog with deferred items**

In `docs/backlog.md`, add a new grouped section for entity hierarchy V2 (match the existing table style — id, title, status `📋`, description). Add rows for:

- Latency-free physics hierarchy pass (propagation in the fixed lane before `PhysicsRequest`), pointing to `docs/gameplay/entity-hierarchy.md` §5.4.
- Exact shear rendering (world-matrix seam on nebula `Node`, e.g. `Node.setLocalMatrix`), §5.5.
- Dirty-tracking per subtree for `TransformPropagationSystem`, §5.2.
- Transform composition for dynamic bodies (local = world − parent), §9.
- Orphan-on-destroy option (reparent to root instead of recursive destroy), §3.3.
- Dedicated editor `onReparent` signal, §7.
- Generic typed relationships (flecs-style) beyond parent/child, §9.

- [ ] **Step 5: Mark the design doc implemented**

In `docs/gameplay/entity-hierarchy.md`:
- Change the status line to: `> **Statut : implémenté.**` (keep the one-line summary).
- Tick every box in the §10 checklist (`- [ ]` → `- [x]`).

- [ ] **Step 6: Full monorepo test sweep (no regressions across packages)**

Run: `pnpm -r test`
Expected: PASS across `@atlasjs/nexus`, `@atlasjs/math`, `@atlasjs/gameplay` (and any other packages with tests).

- [ ] **Step 7: Commit**

```bash
git add apps/sandbox/src/game/EcsScene.ts docs/backlog.md docs/gameplay/entity-hierarchy.md
git commit -m "feat(sandbox): native entity attach demo + mark hierarchy implemented"
```

---

## Notes for the implementer

- **Scheduling recap:** propagation runs in `update`/`Late` (after scripts/animator at `Logic`). Rendering (`render`/`PreRender`) runs later in the same frame, so `WorldTransform2D` is fresh for sprites. Physics (`fixed` lane) runs before `update`, so a *parented* body reads the previous frame's `WorldTransform2D` (one-frame lag — acceptable, matches existing physics latency); *root* bodies read `Transform2D` directly (no lag).
- **Why roots use `Transform2D` in physics push:** it preserves the existing kinematic-authority tests (a direct `Transform2D` write must reach the body the same frame) and is exact because a root's local transform equals its world transform.
- **First-frame transient:** on the very first `fixed` step a brand-new parented body has no `WorldTransform2D` yet; `resolvePlacement` falls back to `Transform2D`. The next frame it composes correctly.
- **Build ordering:** always `pnpm --filter @atlasjs/nexus build` and `pnpm --filter @atlasjs/math build` before gameplay typechecks/tests against their new public APIs (they resolve from `dist`).
```
