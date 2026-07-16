# SpriteRenderer + Sprite asset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Project convention (CLAUDE.md):** do **not** commit automatically. Each task ends with a suggested commit command, but leave the changes for the author to review and commit. Pause after each task.

**Goal:** Replace the bancal sprite pipeline with a Unity-style model — a `Sprite` asset (texture + region + pivot) driven through a thin `SpriteRendererComponent` façade over a `SpriteRender` source-of-truth component, projected onto the nebula scene by a rewritten `SpriteRenderSystem` with proper lifecycle cleanup.

**Architecture:** Three levels. A minimal `Asset` contract in `@atlasjs/assets` (generic, backend-agnostic). A `Sprite` asset in `@atlasjs/gameplay` referencing the nebula GPU `Texture2D`. `SpriteRender` (L1, source of truth) holds `sprite`/`color`/`flipX`/`flipY`/`visible`/`sortingOrder`; `SpriteRendererComponent` (L2 façade) is a stateless proxy; `SpriteRenderSystem` mirrors the state onto a nebula `Sprite` scene node and unmounts it on component removal.

**Tech Stack:** TypeScript, Turborepo + pnpm workspaces, tsdown (build), vitest (test). Packages: `@atlasjs/assets`, `@atlasjs/gameplay`, `@atlasjs/nebula`, `@atlasjs/nexus`, `@atlasjs/math`.

## Global Constraints

- Always type the code, even trivially (function params, variables, class members). No comments.
- Typecheck with `tsc --noEmit` — never `tsc -b`.
- Respect the L1/L2 taxonomy: engine components in `components/` (no suffix), façades in `scripting/components/` (`*Component`, extends `ScriptComponent`, `static engine`).
- Façades stay stateless: re-resolve via `resolve()`/`requireComponent` on every access, no cached datum.
- Flip is applied by the system as `scale × sign`, never via the nebula `Sprite.flipX()/flipY()` (which mutate scale).
- When a dependency's public API changes, rebuild its `dist` so downstream typecheck/preview resolve it.
- Spec: `docs/sprite-renderer-redesign.md`.

---

### Task 1: Minimal `Asset` contract in `@atlasjs/assets`

Rewrite the dead `@atlasjs/assets` package down to a single generic contract.

**Files:**
- Delete: `packages/assets/src/public/` (whole directory — `AssetManager.ts`, `TextureHandle.ts`, `Texture2D.ts`, `Tokens.ts`, `AssetPlugin.ts`, `types/`)
- Create: `packages/assets/src/Asset.ts`
- Modify: `packages/assets/src/index.ts`

**Interfaces:**
- Produces: `interface Asset { readonly id: string; readonly kind: string; dispose(): void }` exported from `@atlasjs/assets`.

- [ ] **Step 1: Delete the dead implementation**

```bash
rm -rf packages/assets/src/public
```

- [ ] **Step 2: Create the `Asset` contract**

`packages/assets/src/Asset.ts`:

```ts
export interface Asset {
  readonly id: string;
  readonly kind: string;
  dispose(): void;
}
```

- [ ] **Step 3: Rewrite the package entry point**

Replace the entire contents of `packages/assets/src/index.ts` with:

```ts
export * from "./Asset";
```

- [ ] **Step 4: Build the package**

Run: `pnpm --filter @atlasjs/assets build`
Expected: build succeeds; `packages/assets/dist/index.d.mts` is emitted and declares `interface Asset`.

- [ ] **Step 5: Verify the declaration was emitted**

Run: `grep -n "interface Asset" packages/assets/dist/index.d.mts`
Expected: one match showing `id`, `kind`, `dispose`.

- [ ] **Step 6: Commit (author reviews first)**

```bash
git add packages/assets
git commit -m "refactor(assets): replace dead package with minimal Asset contract"
```

---

### Task 2: `Sprite` asset in `@atlasjs/gameplay`

Add the assets dependency, create the immutable `Sprite` asset, wire exports, add a shared test fake.

**Files:**
- Modify: `packages/gameplay/package.json` (add dependency)
- Create: `packages/gameplay/src/assets/Sprite.ts`
- Create: `packages/gameplay/src/assets/index.ts`
- Modify: `packages/gameplay/src/index.ts`
- Create: `packages/gameplay/test/helpers/fakes.ts`
- Test: `packages/gameplay/test/sprite-asset.test.ts`

**Interfaces:**
- Consumes: `Asset` from `@atlasjs/assets` (Task 1); `Texture2D` from `@atlasjs/nebula`; `Bound`, `Vec2` from `@atlasjs/math`.
- Produces:
  - `class Sprite implements Asset` with `readonly id: string`, `readonly kind: string`, `readonly texture: Texture2D`, `readonly rect: Bound`, `readonly pivot: Vec2`, ctor `(texture: Texture2D, options?: SpriteOptions)`, `dispose(): void`.
  - `interface SpriteOptions { rect?: Bound; pivot?: Vec2; id?: string }`.
  - `fakeTexture(id?, width?, height?): Texture2D` test helper.

- [ ] **Step 1: Add the workspace dependency**

In `packages/gameplay/package.json`, add to `"dependencies"` (keep alphabetical with the existing `@atlasjs/*` entries):

```json
"@atlasjs/assets": "workspace:*",
```

Then link it:

Run: `pnpm install`
Expected: install completes; `@atlasjs/assets` is linked into `packages/gameplay/node_modules/@atlasjs/`.

- [ ] **Step 2: Add the shared test fake**

`packages/gameplay/test/helpers/fakes.ts`:

```ts
import type { Texture2D } from "@atlasjs/nebula";

export function fakeTexture(
  id: string = "tex",
  width: number = 64,
  height: number = 32,
): Texture2D {
  return {
    id,
    __kind: "texture2D",
    width,
    height,
    dispose: (): void => {},
  } as unknown as Texture2D;
}
```

- [ ] **Step 3: Write the failing test**

`packages/gameplay/test/sprite-asset.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import { Sprite } from "../src/assets";
import { fakeTexture } from "./helpers/fakes";

describe("Sprite asset", () => {
  it("defaults rect to the full texture and pivot to center", () => {
    const sprite: Sprite = new Sprite(fakeTexture("t", 64, 32));

    expect(sprite.kind).toBe("sprite");
    expect(sprite.rect.x).toBe(0);
    expect(sprite.rect.y).toBe(0);
    expect(sprite.rect.width).toBe(64);
    expect(sprite.rect.height).toBe(32);
    expect(sprite.pivot.x).toBe(0.5);
    expect(sprite.pivot.y).toBe(0.5);
  });

  it("clones rect and pivot so caller mutations do not leak in", () => {
    const rect: Bound = new Bound(0, 0, 16, 16);
    const pivot: Vec2 = new Vec2(0, 0);
    const sprite: Sprite = new Sprite(fakeTexture(), { rect, pivot });

    rect.set(99, 99, 99, 99);
    pivot.set(1, 1);

    expect(sprite.rect.width).toBe(16);
    expect(sprite.pivot.x).toBe(0);
  });

  it("accepts an explicit id and has a no-op dispose", () => {
    const sprite: Sprite = new Sprite(fakeTexture(), { id: "hero" });

    expect(sprite.id).toBe("hero");
    expect(() => sprite.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-asset.test.ts`
Expected: FAIL — cannot resolve `../src/assets` / `Sprite` is not defined.

- [ ] **Step 5: Implement the `Sprite` asset**

`packages/gameplay/src/assets/Sprite.ts`:

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "@atlasjs/nebula";
import type { Asset } from "@atlasjs/assets";

export interface SpriteOptions {
  rect?: Bound;
  pivot?: Vec2;
  id?: string;
}

export class Sprite implements Asset {
  public readonly id: string;
  public readonly kind: string = "sprite";
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  public constructor(texture: Texture2D, options?: SpriteOptions) {
    this.texture = texture;
    this.rect =
      options?.rect?.clone() ?? new Bound(0, 0, texture.width, texture.height);
    this.pivot = options?.pivot?.clone() ?? new Vec2(0.5, 0.5);
    this.id =
      options?.id ??
      `sprite:${texture.id}:${this.rect.x}:${this.rect.y}:${this.rect.width}:${this.rect.height}`;
  }

  public dispose(): void {}
}
```

`packages/gameplay/src/assets/index.ts`:

```ts
export * from "./Sprite";
```

- [ ] **Step 6: Wire the public exports**

In `packages/gameplay/src/index.ts`, add these lines after the existing `export * from "./components";` line:

```ts
export * from "./assets";
export { Color } from "@atlasjs/nebula";
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-asset.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit (author reviews first)**

```bash
git add packages/gameplay/package.json packages/gameplay/src/assets packages/gameplay/src/index.ts packages/gameplay/test/helpers/fakes.ts packages/gameplay/test/sprite-asset.test.ts pnpm-lock.yaml
git commit -m "feat(gameplay): add immutable Sprite asset"
```

---

### Task 3: `SpriteRender` L1 component

Turn the source-of-truth component into a full sprite-render state holder.

**Files:**
- Modify: `packages/gameplay/src/components/SpriteRender.ts`
- Test: `packages/gameplay/test/sprite-render.test.ts`

**Interfaces:**
- Consumes: `Sprite` (Task 2); `Color` from `@atlasjs/nebula`.
- Produces: `class SpriteRender` with mutable fields `sprite: Sprite`, `color: Color`, `flipX: boolean`, `flipY: boolean`, `visible: boolean`, `sortingOrder: number`; ctor `(sprite, color?, flipX?, flipY?, visible?, sortingOrder?)`.

- [ ] **Step 1: Write the failing test**

`packages/gameplay/test/sprite-render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../src/assets";
import { SpriteRender } from "../src/components";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteRender", () => {
  it("defaults to white, unflipped, visible, order 0", () => {
    const render: SpriteRender = new SpriteRender(new Sprite(fakeTexture()));

    expect(render.color.r).toBe(1);
    expect(render.color.a).toBe(1);
    expect(render.flipX).toBe(false);
    expect(render.flipY).toBe(false);
    expect(render.visible).toBe(true);
    expect(render.sortingOrder).toBe(0);
  });

  it("accepts explicit overrides", () => {
    const render: SpriteRender = new SpriteRender(
      new Sprite(fakeTexture()),
      Color.Red(),
      true,
      false,
      false,
      7,
    );

    expect(render.color.r).toBe(1);
    expect(render.color.g).toBe(0);
    expect(render.flipX).toBe(true);
    expect(render.visible).toBe(false);
    expect(render.sortingOrder).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render.test.ts`
Expected: FAIL — `SpriteRender` ctor does not accept a `Sprite` / fields missing.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `packages/gameplay/src/components/SpriteRender.ts` with:

```ts
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../assets";

export class SpriteRender {
  public sprite: Sprite;
  public color: Color;
  public flipX: boolean;
  public flipY: boolean;
  public visible: boolean;
  public sortingOrder: number;

  public constructor(
    sprite: Sprite,
    color: Color = Color.White(),
    flipX: boolean = false,
    flipY: boolean = false,
    visible: boolean = true,
    sortingOrder: number = 0,
  ) {
    this.sprite = sprite;
    this.color = color;
    this.flipX = flipX;
    this.flipY = flipY;
    this.visible = visible;
    this.sortingOrder = sortingOrder;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit (author reviews first)**

```bash
git add packages/gameplay/src/components/SpriteRender.ts packages/gameplay/test/sprite-render.test.ts
git commit -m "feat(gameplay): SpriteRender holds sprite, color, flip, visibility, order"
```

---

### Task 4: `SpriteRendererComponent` L2 façade

The Unity-style scripting API — a stateless proxy over `SpriteRender`.

**Files:**
- Modify: `packages/gameplay/src/scripting/components/SpriteRendererComponent.ts`
- Test: `packages/gameplay/test/sprite-renderer-facade.test.ts`

**Interfaces:**
- Consumes: `SpriteRender` (Task 3); `Sprite` (Task 2); `Color` from `@atlasjs/nebula`; `ScriptComponent` from `../core`.
- Produces: `class SpriteRendererComponent extends ScriptComponent<SpriteRender>` with `static engine = SpriteRender`; accessors `sprite`/`color`/`flipX`/`flipY`/`visible`/`sortingOrder`; fluent `setSprite`, `setColor(r,g,b,a?)`, `setFlip(x,y)`, `setVisible`, `setSortingOrder`.

- [ ] **Step 1: Write the failing test**

`packages/gameplay/test/sprite-renderer-facade.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { Color } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender } from "../src/components";
import { SpriteRendererComponent } from "../src/scripting/components";
import { fakeTexture } from "./helpers/fakes";

describe("SpriteRendererComponent facade", () => {
  let world: NexusWorld;
  let entity: Entity;

  beforeEach(() => {
    world = new NexusWorld();
    world.defineComponent(SpriteRender);
    entity = world.createEntity();
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));
  });

  it("writes through to the SpriteRender source of truth", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);

    facade.flipX = true;
    facade.sortingOrder = 5;
    facade.color = Color.Red();

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    expect(render.flipX).toBe(true);
    expect(render.sortingOrder).toBe(5);
    expect(render.color.r).toBe(1);
    expect(render.color.g).toBe(0);
  });

  it("supports fluent setters", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);

    facade.setColor(0, 1, 0).setFlip(false, true).setSortingOrder(3);

    const render: SpriteRender = world.requireComponent(entity, SpriteRender);
    expect(render.color.g).toBe(1);
    expect(render.flipY).toBe(true);
    expect(render.sortingOrder).toBe(3);
  });

  it("is stateless — re-resolves the live component on each access", () => {
    const facade: SpriteRendererComponent = new SpriteRendererComponent(world, entity);

    world.removeComponent(entity, SpriteRender);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()), Color.Blue());

    expect(facade.color.b).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-renderer-facade.test.ts`
Expected: FAIL — `flipX`/`color`/`sortingOrder`/fluent setters not defined on the façade.

- [ ] **Step 3: Rewrite the façade**

Replace the entire contents of `packages/gameplay/src/scripting/components/SpriteRendererComponent.ts` with:

```ts
import { Color } from "@atlasjs/nebula";
import { Sprite } from "../../assets";
import { SpriteRender } from "../../components";
import { ScriptComponent } from "../core";

export class SpriteRendererComponent extends ScriptComponent<SpriteRender> {
  public static readonly engine = SpriteRender;

  public get sprite(): Sprite {
    return this.resolve().sprite;
  }

  public set sprite(value: Sprite) {
    this.resolve().sprite = value;
  }

  public get color(): Color {
    return this.resolve().color;
  }

  public set color(value: Color) {
    this.resolve().color = value;
  }

  public get flipX(): boolean {
    return this.resolve().flipX;
  }

  public set flipX(value: boolean) {
    this.resolve().flipX = value;
  }

  public get flipY(): boolean {
    return this.resolve().flipY;
  }

  public set flipY(value: boolean) {
    this.resolve().flipY = value;
  }

  public get visible(): boolean {
    return this.resolve().visible;
  }

  public set visible(value: boolean) {
    this.resolve().visible = value;
  }

  public get sortingOrder(): number {
    return this.resolve().sortingOrder;
  }

  public set sortingOrder(value: number) {
    this.resolve().sortingOrder = value;
  }

  public setSprite(sprite: Sprite): this {
    this.resolve().sprite = sprite;
    return this;
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.resolve().color.set(r, g, b, a);
    return this;
  }

  public setFlip(x: boolean, y: boolean): this {
    const render: SpriteRender = this.resolve();
    render.flipX = x;
    render.flipY = y;
    return this;
  }

  public setVisible(visible: boolean): this {
    this.resolve().visible = visible;
    return this;
  }

  public setSortingOrder(order: number): this {
    this.resolve().sortingOrder = order;
    return this;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-renderer-facade.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit (author reviews first)**

```bash
git add packages/gameplay/src/scripting/components/SpriteRendererComponent.ts packages/gameplay/test/sprite-renderer-facade.test.ts
git commit -m "feat(gameplay): full SpriteRendererComponent scripting facade"
```

---

### Task 5: Rewrite `SpriteRenderSystem` (projection + swap + unmount)

Project `SpriteRender` onto a nebula scene node every frame, handle sprite swaps, and expose `unmount` for lifecycle cleanup.

**Files:**
- Modify: `packages/gameplay/src/systems/SpriteRenderSystem.ts`
- Test: `packages/gameplay/test/sprite-render-system.test.ts`

**Interfaces:**
- Consumes: `NebulaRenderer`, `Sampler`, `SceneGraph`, `Sprite as SpriteNode` from `@atlasjs/nebula`; `Entity`, `NexusSystem`, `NexusSystemContext`, `SparseSet` from `@atlasjs/nexus`; `Sprite` (Task 2); `SpriteRender`, `Transform2D` (Task 3).
- Produces: `class SpriteRenderSystem implements NexusSystem` with ctor `(nebula: NebulaRenderer)`, `update(ctx: NexusSystemContext): void`, and `unmount(entity: Entity): void`.

- [ ] **Step 1: Write the failing test**

`packages/gameplay/test/sprite-render-system.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import {
  Color,
  NebulaRenderer,
  Sampler,
  SceneGraph,
  Sprite as SpriteNode,
} from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Sprite } from "../src/assets";
import { SpriteRender, Transform2D } from "../src/components";
import { SpriteRenderSystem } from "../src/systems";
import { fakeTexture } from "./helpers/fakes";

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: SpriteRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Transform2D).defineComponent(SpriteRender);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    createSampler: (): Sampler => ({}) as Sampler,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new SpriteRenderSystem(nebula) };
}

function children(scene: SceneGraph): ReadonlyArray<SpriteNode> {
  return scene.root.getChildren() as ReadonlyArray<SpriteNode>;
}

describe("SpriteRenderSystem", () => {
  it("mounts one scene node per SpriteRender entity", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
  });

  it("applies flip as the sign of the transform scale", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    world.requireComponent(entity, Transform2D).scale.set(3, 2);
    world.requireComponent(entity, SpriteRender).flipX = true;

    system.update({ world, dt: 0 });

    const node: SpriteNode = children(scene)[0];
    expect(node.transform.scale.x).toBe(-3);
    expect(node.transform.scale.y).toBe(2);
  });

  it("propagates tint, visibility and sorting order", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

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
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(texture));

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
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture("a")));

    system.update({ world, dt: 0 });
    const first: SpriteNode = children(scene)[0];

    world.requireComponent(entity, SpriteRender).sprite = new Sprite(fakeTexture("b"));
    system.update({ world, dt: 0 });

    expect(children(scene).length).toBe(1);
    expect(children(scene)[0]).not.toBe(first);
  });

  it("unmount removes the node from the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = world.createEntity();
    world.addComponent(entity, Transform2D);
    world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    system.update({ world, dt: 0 });
    expect(children(scene).length).toBe(1);

    system.unmount(entity);
    expect(children(scene).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render-system.test.ts`
Expected: FAIL — `unmount` missing / node not tinted / swap not handled (old system reads texture, not sprite).

- [ ] **Step 3: Rewrite the system**

Replace the entire contents of `packages/gameplay/src/systems/SpriteRenderSystem.ts` with:

```ts
import {
  NebulaRenderer,
  Sampler,
  Sprite as SpriteNode,
} from "@atlasjs/nebula";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

import { Sprite } from "../assets";
import { SpriteRender, Transform2D } from "../components";

interface MountedSprite {
  node: SpriteNode;
  sprite: Sprite;
}

export class SpriteRenderSystem implements NexusSystem {
  private readonly mounted: SparseSet<MountedSprite>;
  private readonly nebula: NebulaRenderer;
  private readonly sampler: Sampler;

  public constructor(nebula: NebulaRenderer) {
    this.mounted = new SparseSet<MountedSprite>();
    this.nebula = nebula;
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(Transform2D, SpriteRender).each((entity, transform, spriteRender) => {
      const node: SpriteNode = this.resolveNode(entity, spriteRender.sprite);

      const scaleX: number = transform.scale.x * (spriteRender.flipX ? -1 : 1);
      const scaleY: number = transform.scale.y * (spriteRender.flipY ? -1 : 1);
      const color: Color = spriteRender.color;

      node
        .setPosition(transform.position.x, transform.position.y)
        .setRotation(transform.rotation)
        .setScale(scaleX, scaleY)
        .setTint(color.r, color.g, color.b, color.a)
        .setVisible(spriteRender.visible);

      node.zIndex = spriteRender.sortingOrder;
    });
  }

  public unmount(entity: Entity): void {
    const mounted: MountedSprite | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return;
    }

    mounted.node.removeFromParent();
    this.mounted.delete(entity);
  }

  private resolveNode(entity: Entity, sprite: Sprite): SpriteNode {
    const mounted: MountedSprite | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return this.mount(entity, sprite).node;
    }

    if (mounted.sprite === sprite) {
      return mounted.node;
    }

    if (mounted.node.texture !== sprite.texture) {
      this.unmount(entity);
      return this.mount(entity, sprite).node;
    }

    mounted.node.setSourceRect(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.width,
      sprite.rect.height,
    );
    mounted.node.setAnchor(sprite.pivot.x, sprite.pivot.y);
    mounted.sprite = sprite;

    return mounted.node;
  }

  private mount(entity: Entity, sprite: Sprite): MountedSprite {
    const node: SpriteNode = new SpriteNode(sprite.texture, this.sampler);
    node.setSourceRect(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.width,
      sprite.rect.height,
    );
    node.setAnchor(sprite.pivot.x, sprite.pivot.y);
    this.nebula.scene.addChild(node);

    const mounted: MountedSprite = { node, sprite };
    this.mounted.set(entity, mounted);

    return mounted;
  }
}
```

Add the `Color` type import at the top (used to type the local in `update`):

```ts
import { Color, NebulaRenderer, Sampler, Sprite as SpriteNode } from "@atlasjs/nebula";
```

(Replace the three-line nebula import above with this single line.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render-system.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit (author reviews first)**

```bash
git add packages/gameplay/src/systems/SpriteRenderSystem.ts packages/gameplay/test/sprite-render-system.test.ts
git commit -m "feat(gameplay): rewrite SpriteRenderSystem with full sync, swap and unmount"
```

---

### Task 6: Wire lifecycle cleanup in `GameplayPlugin` + harness support

Remove the mounted node when its `SpriteRender` is removed or its entity destroyed, and let the test harness observe the scene.

**Files:**
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Modify: `packages/gameplay/test/helpers/harness.ts`
- Test: `packages/gameplay/test/sprite-render-lifecycle.test.ts`

**Interfaces:**
- Consumes: `SpriteRenderSystem.unmount` (Task 5); `world.onRemove` from `@atlasjs/nexus`; `SceneGraph` from `@atlasjs/nebula`.
- Produces: `GameplayPlugin` unsubscribes a `SpriteRender` remove-listener on uninstall; the harness `fakeNebula.scene` is a real `SceneGraph`.

- [ ] **Step 1: Upgrade the harness fake renderer**

In `packages/gameplay/test/helpers/harness.ts`, change the nebula import to include `SceneGraph`:

```ts
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";
```

Then replace the `fakeNebula` declaration:

```ts
const fakeNebula = { createSampler: () => ({}), scene: new SceneGraph() };
```

- [ ] **Step 2: Write the failing test**

`packages/gameplay/test/sprite-render-lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { Sprite, SpriteRender, Transform2D } from "../src";
import { Entity } from "@atlasjs/nexus";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

function sceneChildCount(harness: Harness): number {
  const nebula: NebulaRenderer = harness.services.get(NEBULA_RENDERER);
  return nebula.scene.root.getChildren().length;
}

describe("sprite render lifecycle", () => {
  it("mounts on frame and unmounts on SpriteRender removal", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    harness.frame();
    expect(sceneChildCount(harness)).toBe(1);

    harness.world.removeComponent(entity, SpriteRender);
    expect(sceneChildCount(harness)).toBe(0);
  });

  it("unmounts when the entity is destroyed", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(fakeTexture()));

    harness.frame();
    expect(sceneChildCount(harness)).toBe(1);

    harness.world.destroyEntity(entity);
    expect(sceneChildCount(harness)).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render-lifecycle.test.ts`
Expected: FAIL — after removal/destroy the child count is still 1 (no `onRemove` wiring yet).

- [ ] **Step 4: Wire `onRemove` in the plugin**

In `packages/gameplay/src/GameplayPlugin.ts`, inside `install`, add a third entry to the `this.unsubscribers.push(...)` call (which currently pushes the `PhysicsBodyRef` and `RigidBody2D` listeners). Add after the `RigidBody2D` listener:

```ts
      world.onRemove(SpriteRender, (entity: Entity) => {
        spriteRenderSystem.unmount(entity);
      }),
```

The block becomes:

```ts
    this.unsubscribers.push(
      world.onRemove(PhysicsBodyRef, (_entity: Entity, ref: PhysicsBodyRef) => {
        inertia.destroyRigidBody(ref.body);
      }),

      world.onRemove(RigidBody2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsBodyRef)) {
          world.removeComponent(entity, PhysicsBodyRef);
        }
      }),

      world.onRemove(SpriteRender, (entity: Entity) => {
        spriteRenderSystem.unmount(entity);
      }),
    );
```

(`SpriteRender` and `spriteRenderSystem` are already in scope — no new imports.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/sprite-render-lifecycle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full gameplay suite + typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run`
Expected: all tests pass (existing + the 5 new files).

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no type errors.

- [ ] **Step 7: Commit (author reviews first)**

```bash
git add packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/helpers/harness.ts packages/gameplay/test/sprite-render-lifecycle.test.ts
git commit -m "feat(gameplay): unmount sprite node on SpriteRender removal"
```

---

### Task 7: Migrate the sandbox to the `Sprite` asset

Update the only consumer to build `Sprite` assets and give every rendered entity a `Transform2D`.

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`

**Interfaces:**
- Consumes: `Sprite`, `SpriteRender`, `Transform2D`, `ScriptManager`, `SCRIPT_MANAGER` from `@atlasjs/gameplay`; `nebula.createTexture2D` from `@atlasjs/nebula`.

- [ ] **Step 1: Rebuild gameplay so the sandbox resolves the new API**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build succeeds; `Sprite` is present in `packages/gameplay/dist/index.d.mts`.

Verify: `grep -n "class Sprite" packages/gameplay/dist/index.d.mts`
Expected: one match.

- [ ] **Step 2: Rewrite the scene**

Replace the entire contents of `apps/sandbox/src/game/EcsScene.ts` with:

```ts
import SwordImage from "../../assets/game/swords/Iicon_32_01.png";
import SeaLionImage from "../../assets/sealion.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { TestScript } from "./scripts/TestScript";

import {
  type ScriptManager,
  SCRIPT_MANAGER,
  Sprite,
  SpriteRender,
  Transform2D,
} from "@atlasjs/gameplay";

import {
  type NebulaRenderer,
  type Texture2D,
  NEBULA_RENDERER,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const nebula: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const swordTexture: Texture2D = await this.loadTexture(nebula, SwordImage);
    const seaLionTexture: Texture2D = await this.loadTexture(nebula, SeaLionImage);

    const swordSprite: Sprite = new Sprite(swordTexture);
    const seaLionSprite: Sprite = new Sprite(seaLionTexture);

    const player1: Entity = nexus.createEntity();
    const player2: Entity = nexus.createEntity();

    nexus.addComponent(player1, Transform2D);
    nexus.addComponent(player1, SpriteRender, swordSprite);

    nexus.addComponent(player2, Transform2D);
    nexus.addComponent(player2, SpriteRender, seaLionSprite);

    scriptManager.attach(player1, TestScript);
  }

  private async loadTexture(
    nebula: NebulaRenderer,
    src: string,
  ): Promise<Texture2D> {
    const image: HTMLImageElement = new Image();
    image.src = src;
    await image.decode();

    const source: ImageBitmap = await createImageBitmap(image, {
      imageOrientation: "flipY",
    });

    return nebula.createTexture2D({
      source,
      width: source.width,
      height: source.height,
    });
  }
}
```

- [ ] **Step 3: Typecheck / build the sandbox**

Run: `pnpm --filter ./apps/sandbox build`
Expected: build succeeds with no type errors.

- [ ] **Step 4 (optional visual check): run the sandbox and confirm the sprite renders**

Use the dev-server preview (via `.claude/launch.json` if configured) and confirm the sea-lion sprite appears and the `TestScript`-controlled entity moves with WASD. If no launch config exists, skip — the build in Step 3 is the required verification.

- [ ] **Step 5: Commit (author reviews first)**

```bash
git add apps/sandbox/src/game/EcsScene.ts
git commit -m "refactor(sandbox): drive EcsScene with the Sprite asset"
```

---

### Task 8: Drop the phantom `@atlasjs/assets` dependency from nebula

`@atlasjs/nebula` declares `@atlasjs/assets` but never imports it. Remove the stale edge.

**Files:**
- Modify: `packages/nebula/package.json`

- [ ] **Step 1: Remove the dependency**

In `packages/nebula/package.json`, delete the `"@atlasjs/assets": "workspace:*",` line from `"dependencies"`.

- [ ] **Step 2: Re-link the workspace**

Run: `pnpm install`
Expected: install completes; lockfile updates.

- [ ] **Step 3: Confirm nebula still builds**

Run: `pnpm --filter @atlasjs/nebula build`
Expected: build succeeds (nebula never imported assets, so nothing breaks).

- [ ] **Step 4: Commit (author reviews first)**

```bash
git add packages/nebula/package.json pnpm-lock.yaml
git commit -m "chore(nebula): drop unused @atlasjs/assets dependency"
```

---

## Self-Review

**Spec coverage** (against `docs/sprite-renderer-redesign.md`):
- `Asset` contract in `@atlasjs/assets` → Task 1.
- `Sprite` asset (texture + rect + pivot, immutable, atlas-ready) → Task 2.
- `SpriteRender` L1 (sprite/color/flip/visible/sortingOrder) → Task 3.
- `SpriteRendererComponent` L2 façade → Task 4.
- `SpriteRenderSystem` rewrite (mount, full sync, flip-as-scale-sign, swap rect vs texture) → Task 5.
- Lifecycle cleanup via `world.onRemove(SpriteRender)` → Task 6.
- Sandbox migration → Task 7.
- Drop nebula's phantom assets dep → Task 8.
- Re-exports (`Sprite`, `SpriteRender`, `SpriteRendererComponent`, `Color`) → Task 2 Step 6.
- Tests (asset defaults, façade round-trip, flip projection, swap, onRemove) → Tasks 2–6.

**Out of scope (confirmed, no tasks):** `AssetManager`, animation integration, blend mode, configurable sampler, nullable sprite.

**Placeholder scan:** none — every code and command step is concrete.

**Type consistency:** `SpriteRender` ctor `(sprite, color?, flipX?, flipY?, visible?, sortingOrder?)` is consumed identically in Tasks 4/5/6 tests; `SpriteRenderSystem.unmount(entity)` defined in Task 5 and called in Task 6; `Sprite as SpriteNode` alias used consistently in Task 5; `fakeTexture` signature stable across Tasks 2–6.
