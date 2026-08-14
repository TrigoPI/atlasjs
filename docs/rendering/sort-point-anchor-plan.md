# Sort Point Anchor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `ySorted` sprite derive its depth (`sortPrimary`) from a *carrier* entity so an equippable accessory sorts as one unit with its owner while `sortingOrder` stacks it on top.

**Architecture:** Add one opt-in field `sortPointEntity: Entity | null` to the `SpriteRender` engine component. `SpriteRenderSystem` reads the carrier's `WorldTransform2D.y` (falling back to the sprite's own world Y when the carrier is absent/destroyed) and feeds it to the existing `applySortFields`. Nebula is untouched; the `ySorted` semantics are unchanged — only *which Y* is passed changes.

**Tech Stack:** TypeScript, `@atlasjs/gameplay` (Nexus ECS + Nebula render bridge), Vitest.

## Global Constraints

- **Type everything**, even trivial types (params, variables, class fields). No untyped locals.
- **No comments** in code.
- **Type-only imports must use `import type`** — a value import of a type breaks the Vite runtime in `apps/*` even though `tsc` passes.
- **Typecheck with `tsc --noEmit`**, never `tsc -b` (it emits artifacts next to sources).
- **Run prettier on touched `.ts`/`.tsx` before staging** — scoped to the files you changed, never repo-wide. Do **not** reformat `docs/*.md`.
- Do **not** commit automatically unless a step says to; the repo owner reviews and commits. (This plan's commit steps are explicit and expected.)
- **Warn-never-throw** on dangling references: a missing carrier degrades gracefully, never throws.

---

### Task 1: `sortPointEntity` field + `SpriteRenderSystem` resolution

The whole engine feature, TDD. The field addition is scaffolding the tests need to compile; the reviewable deliverable is the resolved sort behavior.

**Files:**
- Modify: `packages/gameplay/src/components/SpriteRender.ts`
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts`
- Test: `packages/gameplay/test/sprite-render-system.test.ts`

**Interfaces:**
- Consumes (existing, do not change signatures):
  - `WorldTransform2D.getPosition(out?: Vec2): Vec2`
  - `NexusWorld.getComponent<T>(entity: Entity, type): T | undefined`
  - `applySortFields(target, sortingLayers, layerName: string, sortingOrder: number, worldY: number): void`
  - `SpriteNode.sortPrimary: number`, `SpriteNode.sortSecondary: number`
  - `SortingLayers.define([{ name, mode }]): this`
- Produces (relied on by Task 2):
  - `SpriteRender.sortPointEntity: Entity | null` (default `null`)

- [ ] **Step 1: Add the opt-in field to `SpriteRender`**

Add the import and the field. Field is assigned post-construction (like `sortingLayer`/`sortingOrder` in prefabs), so it is not added to the constructor.

`packages/gameplay/src/components/SpriteRender.ts`:

```ts
import { Color } from "@atlasjs/nebula";
import type { Entity } from "@atlasjs/nexus";
import { Sprite } from "../assets";

export class SpriteRender {
  public sprite: Sprite;
  public color: Color;
  public flipX: boolean;
  public flipY: boolean;
  public visible: boolean;
  public sortingOrder: number;
  public sortingLayer: string;
  public sortPointEntity: Entity | null;

  public constructor(
    sprite: Sprite,
    color: Color = Color.White(),
    flipX: boolean = false,
    flipY: boolean = false,
    visible: boolean = true,
    sortingOrder: number = 0,
    sortingLayer: string = "Default",
  ) {
    this.sprite = sprite;
    this.color = color;
    this.flipX = flipX;
    this.flipY = flipY;
    this.visible = visible;
    this.sortingOrder = sortingOrder;
    this.sortingLayer = sortingLayer;
    this.sortPointEntity = null;
  }
}
```

- [ ] **Step 2: Add the failing tests**

Append to `packages/gameplay/test/sprite-render-system.test.ts`. First, make the existing `setup()` accept an optional pre-configured `SortingLayers` (backward compatible — existing calls pass nothing). Change its signature:

```ts
function setup(sortingLayers: SortingLayers = new SortingLayers()): {
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

  return { world, scene, system: new SpriteRenderSystem(nebula, sortingLayers) };
}
```

Then add a helper and a new `describe` block at the end of the file:

```ts
function ySortedLayers(): SortingLayers {
  return new SortingLayers().define([{ name: "Entities", mode: "ySorted" }]);
}

function anchorAt(world: NexusWorld, y: number): Entity {
  const entity: Entity = world.createEntity();
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(new Transform2D(new Vec2(0, y)));
  return entity;
}

describe("SpriteRenderSystem sort point anchor", () => {
  it("resolves sortPrimary from the carrier's world Y on a ySorted layer", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const carrier: Entity = anchorAt(world, 100);
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = carrier;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(100);
  });

  it("stacks the accessory above its carrier via sortingOrder at the shared Y", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const player: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 100)),
    );
    const playerRender: SpriteRender = world.requireComponent(player, SpriteRender);
    playerRender.sortingLayer = "Entities";
    playerRender.sortingOrder = 10;

    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const swordRender: SpriteRender = world.requireComponent(sword, SpriteRender);
    swordRender.sortingLayer = "Entities";
    swordRender.sortingOrder = 20;
    swordRender.sortPointEntity = player;

    system.update({ world, dt: 0 });

    const playerNode: SpriteNode = children(scene)[0];
    const swordNode: SpriteNode = children(scene)[1];
    expect(swordNode.sortPrimary).toBe(playerNode.sortPrimary);
    expect(swordNode.sortSecondary).toBeGreaterThan(playerNode.sortSecondary);
  });

  it("falls back to its own world Y when the carrier has no WorldTransform2D", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const orphan: Entity = world.createEntity();
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = orphan;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(80);
  });

  it("falls back to its own world Y when the carrier was destroyed", () => {
    const { world, scene, system } = setup(ySortedLayers());
    const carrier: Entity = anchorAt(world, 100);
    const sword: Entity = mount(
      world,
      new Sprite(fakeTexture()),
      new Transform2D(new Vec2(0, 80)),
    );
    const render: SpriteRender = world.requireComponent(sword, SpriteRender);
    render.sortingLayer = "Entities";
    render.sortPointEntity = carrier;

    world.destroyEntity(carrier);

    expect(() => system.update({ world, dt: 0 })).not.toThrow();
    const node: SpriteNode = children(scene)[0];
    expect(node.sortPrimary).toBe(80);
  });
});
```

> **Why the destroyed-carrier test matters:** `world.getComponent` on a *destroyed* entity **throws** (`assertEntityExists`) — it only returns `undefined` for a live entity missing the component. The orphan test above never destroys its entity, so it does not cover this. The Step 4 code below guards with the non-throwing `world.exists(...)` precisely for this case.

- [ ] **Step 3: Run the new tests — verify they FAIL**

Run: `pnpm --filter @atlasjs/gameplay test -- sprite-render-system`
Expected: the three new tests FAIL. The first asserts `sortPrimary` 100 but gets 80 (own Y still used); the stacking test's `sortPrimary` values differ (100 vs 80). Field exists so the file compiles.

- [ ] **Step 4: Implement the resolution in `SpriteRenderSystem`**

Add a `sortScratch` field and resolve the sort Y before `applySortFields`.

In the constructor of `packages/gameplay/src/systems/SpriteRenderSystem.ts`, add the scratch alongside the existing ones:

```ts
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;
  private readonly sortScratch: Vec2;
```

```ts
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
    this.sortScratch = new Vec2();
```

Then replace the `applySortFields(...)` call at the end of the `update` query callback with the resolution + call:

```ts
      let sortY: number = position.y;

      if (
        spriteRender.sortPointEntity !== null &&
        world.exists(spriteRender.sortPointEntity)
      ) {
        const carrier: WorldTransform2D | undefined = world.getComponent(
          spriteRender.sortPointEntity,
          WorldTransform2D,
        );

        if (carrier !== undefined) {
          sortY = carrier.getPosition(this.sortScratch).y;
        }
      }

      applySortFields(
        node,
        this.sortingLayers,
        spriteRender.sortingLayer,
        spriteRender.sortingOrder,
        sortY,
      );
```

(`WorldTransform2D` is already imported in this file; `world` is destructured from the `NexusSystemContext` at the top of `update`.) The `world.exists(...)` guard is required: `world.getComponent` on a destroyed entity throws via `assertEntityExists` (`packages/nexus/src/world/NexusWorld.ts`), returning `undefined` only for a live entity missing the component. `world.exists` (`NexusWorld.ts:66`) is a non-throwing, generation-safe check.

- [ ] **Step 5: Run the tests — verify they PASS**

Run: `pnpm --filter @atlasjs/gameplay test -- sprite-render-system`
Expected: all `sprite-render-system` tests PASS (the three new ones plus the pre-existing ones).

- [ ] **Step 6: Full package gate**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS.

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no errors.

Run: `pnpm exec prettier --write packages/gameplay/src/components/SpriteRender.ts packages/gameplay/src/systems/SpriteRenderSystem.ts packages/gameplay/test/sprite-render-system.test.ts`
Expected: files formatted (or already clean).

- [ ] **Step 7: Commit**

```bash
git add packages/gameplay/src/components/SpriteRender.ts packages/gameplay/src/systems/SpriteRenderSystem.ts packages/gameplay/test/sprite-render-system.test.ts
git commit -m "feat(gameplay): sort point anchor for ySorted sprites

SpriteRender.sortPointEntity lets an accessory derive its ySorted depth
from a carrier entity's world Y, so sortingOrder stacks it above the
carrier while both interleave with the scene as one unit."
```

---

### Task 2: Wire the sword to sort at its owner in `apps/dino-brawl`

App integration + browser verification. No unit test — this is composition-root wiring; correctness is verified in the running app.

**Files:**
- Modify: `apps/dino-brawl/src/game/prefabs/SwordPrefab.ts`

**Interfaces:**
- Consumes: `SpriteRender.sortPointEntity: Entity | null` (Task 1); `SwordPrefabProps.owner: Entity` (already present).

- [ ] **Step 1: Set the sort point to the owner**

In `apps/dino-brawl/src/game/prefabs/SwordPrefab.ts`, inside `build`, after the two existing `renderer.*` assignments:

```ts
      const renderer: SpriteRender = entity.add(SpriteRender, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Sword;
      renderer.sortPointEntity = props.owner;
```

`props.owner` is already a raw `Entity` (the prefab's `SwordPrefabProps.owner: Entity`), which is exactly the type `sortPointEntity` expects — no cast, no new import.

- [ ] **Step 2: Prettier the touched file**

Run: `pnpm exec prettier --write apps/dino-brawl/src/game/prefabs/SwordPrefab.ts`
Expected: formatted (or already clean).

- [ ] **Step 3: Browser-verify in the running app**

The dev server serves WebGPU; verify visually rather than trusting the diff.

1. `preview_start` the dino-brawl dev server (`{ name: ... }` from `.claude/launch.json`; if absent, add the app's `pnpm dev` config first).
2. Once loaded, `read_console_messages` — expect no new errors.
3. `computer { action: "screenshot" }` — confirm the sword now renders **in front of** the player.
4. Move the player so its feet cross **behind** a tree/occluder; screenshot again — confirm player **and** sword go behind the tree together (they interleave as one unit), and the sword stays in front of the player.

Expected: sword drawn on top of the player in both positions; the pair occludes/is-occluded by the scene by the player's foot Y.

Note: on the very first frame after spawn the owner's `WorldTransform2D` may not exist yet (propagation runs after spawn); the sword falls back to its own Y for that single frame, then locks onto the owner. This is the intended warn-never-throw degrade — no action needed.

- [ ] **Step 4: Commit**

```bash
git add apps/dino-brawl/src/game/prefabs/SwordPrefab.ts
git commit -m "feat(dino-brawl): sort the sword at its owner so it stacks above the player"
```

---

## Self-Review

**Spec coverage** (against `docs/rendering/sort-point-anchor.md`):
- §4.1 field `sortPointEntity` → Task 1 Step 1. ✓
- §4.2 system resolution + `sortScratch` + silent fallback → Task 1 Step 4; fallback test Step 2. ✓
- §4.3 data flow (visual position vs depth) → verified by Task 1 stacking test + Task 2 browser check. ✓
- §4.4 SwordPrefab one-liner → Task 2 Step 1. ✓
- §4.5 scripting exposure (`SpriteRenderer` identity token already carries the field; no new API) → no code needed; covered by "no cast, no new import" note. ✓
- §5 tests (resolution, tiebreak, fallback) → Task 1 Step 2, three tests. ✓
- §6 invariants (opt-in default null, ySorted untouched, nebula boundary, zero-alloc scratch) → Task 1 Steps 1/4. ✓
- §7 future extensions → out of scope, correctly omitted. ✓

**Placeholder scan:** none — all steps carry concrete code and commands.

**Type consistency:** `sortPointEntity: Entity | null` used identically in Task 1 (definition) and Task 2 (assignment). `getPosition(out)`, `getComponent`, `sortPrimary/sortSecondary`, `define(...)` match verified source signatures.
