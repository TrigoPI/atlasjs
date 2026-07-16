# Sprite Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire sprite animation into the gameplay path — an `Animator` component (named clips + `play(name)`) driven by an `AnimatorSystem` that pushes the current frame into `SpriteRender`.

**Architecture:** Reuse nebula's `SpriteSheet`/`Frame`/`SpriteAnimation`/`AnimationPlayer`, made **dt-driven** (accumulator, no wall-clock). The gameplay `Animator` (LEVEL-1 component) wraps an `AnimationPlayer`. The `AnimatorSystem` ticks the active clip by the engine `dt` and swaps `SpriteRender.sprite` to a cached `Sprite` asset for the current `Frame`; the existing `SpriteRenderSystem` projects that swap onto the mounted node (same texture → `setSourceRect`, no node recreation).

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, vitest. Packages `@atlasjs/nebula` and `@atlasjs/gameplay`.

**Spec:** `docs/gameplay/sprite-animation.md`

## Global Constraints

- **Type everything**, even trivially (function params, variables, class fields) — repo rule.
- **No comments** in code — repo rule.
- **`nebula` core stays backend-agnostic**: no `@webgpu/types`, no WGSL, no backend import.
- **Two-level component model** (`packages/gameplay/CLAUDE.md`): `Animator` is a LEVEL-1 engine component (`components/`, no `*Component` suffix), used raw by scripts. No façade.
- **Do not auto-commit unless the step says so**; the repo convention (superpowers) is to pause for author review, but this plan includes explicit commit steps per task — the executor may hold them for the author.
- **`dt` is in seconds** (`RafLoop`: `(t-last)/1000`). `SpriteAnimation.frameDuration` is in ms (`1000/fps`). The system converts `dt * 1000`.
- **Rebuild a package's `dist` after changing its public API** so dependents typecheck/resolve: `pnpm --filter <pkg> build`. Typecheck with `tsc --noEmit`, never `tsc -b`.
- Test runner: `pnpm --filter <pkg> test` (vitest run). Single file: `pnpm --filter <pkg> exec vitest run <path>`.

---

### Task 1: Make `SpriteAnimation` dt-driven (nebula)

Replace the internal wall-clock `Clock` with an `elapsedMs` accumulator advanced by an explicit `tick(deltaMs)`.

**Files:**
- Modify: `packages/nebula/src/animations/SpriteAnimation.ts`
- Test: `packages/nebula/test/SpriteAnimation.test.ts` (create)

**Interfaces:**
- Consumes: `Frame` (`packages/nebula/src/animations/Frame.ts` — `{ texture: Texture2D; rect: Bound }`), `SpriteAnimationOptions` (`{ frames: Frame[]; fps: number; loop?: boolean; autoPlay?: boolean }`), `Sprite` node (`../graphics`, has `setFrame(frame: Frame)`).
- Produces: `SpriteAnimation` with `tick(deltaMs: number): void`, `getCurrentFrame(): Frame`, `getCurrentFrameIndex(): number`, `isPlaying(): boolean`, `getDuration(): number`, `play()`, `pause()`, `resume()`, `stop()`, `updateAndApply(sprite: Sprite, deltaMs: number): void`.

- [ ] **Step 1: Write the failing tests**

Create `packages/nebula/test/SpriteAnimation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";

import { SpriteAnimation, Frame } from "../src";
import { Texture2D } from "../src/core";

function fakeTexture(): Texture2D {
  return {
    id: "t",
    __kind: "texture2D",
    width: 64,
    height: 16,
    destroy: (): void => {},
  } as Texture2D;
}

function frames(n: number): Frame[] {
  const texture: Texture2D = fakeTexture();
  return Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 16)),
  );
}

describe("SpriteAnimation (dt-driven)", () => {
  it("advances one frame once frameDuration elapses", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    expect(anim.getCurrentFrameIndex()).toBe(0);
    anim.tick(50);
    expect(anim.getCurrentFrameIndex()).toBe(0);
    anim.tick(60);
    expect(anim.getCurrentFrameIndex()).toBe(1);
  });

  it("wraps the index while looping", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(2),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(250);
    expect(anim.getCurrentFrameIndex()).toBe(0);
  });

  it("clamps and stops on the last frame when not looping", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: false,
      autoPlay: true,
    });
    anim.tick(1000);
    expect(anim.getCurrentFrameIndex()).toBe(2);
    expect(anim.isPlaying()).toBe(false);
  });

  it("does not advance while paused and resumes without reset", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(110);
    anim.pause();
    anim.tick(500);
    expect(anim.getCurrentFrameIndex()).toBe(1);
    anim.resume();
    anim.tick(100);
    expect(anim.getCurrentFrameIndex()).toBe(2);
  });

  it("stop resets to frame 0 and halts", () => {
    const anim: SpriteAnimation = new SpriteAnimation({
      frames: frames(3),
      fps: 10,
      loop: true,
      autoPlay: true,
    });
    anim.tick(150);
    anim.stop();
    expect(anim.getCurrentFrameIndex()).toBe(0);
    expect(anim.isPlaying()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/SpriteAnimation.test.ts`
Expected: FAIL — `tick` is not a function / current behavior uses `Clock`.

- [ ] **Step 3: Rewrite `SpriteAnimation.ts`**

Replace the entire contents of `packages/nebula/src/animations/SpriteAnimation.ts` with:

```ts
import { SpriteAnimationOptions } from "./animation-types";
import { Sprite } from "../graphics";

import { Frame } from "./Frame";

export class SpriteAnimation {
  private readonly frames: Frame[];
  private readonly frameDuration: number;
  private readonly loop: boolean;

  private currentFrameIndex: number;
  private playing: boolean;
  private elapsedMs: number;

  public constructor(options: SpriteAnimationOptions) {
    if (options.frames.length === 0) {
      throw new Error("SpriteAnimation requires at least one frame.");
    }

    if (options.fps <= 0) {
      throw new Error("SpriteAnimation fps must be greater than 0.");
    }

    this.frames = options.frames;
    this.currentFrameIndex = 0;
    this.frameDuration = 1000 / options.fps;
    this.playing = options.autoPlay ?? false;
    this.loop = options.loop ?? false;
    this.elapsedMs = 0;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getCurrentFrame(): Frame {
    return this.frames[this.currentFrameIndex];
  }

  public getDuration(): number {
    return this.frames.length * this.frameDuration;
  }

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  public play(): void {
    this.playing = true;
    this.elapsedMs = 0;
    this.currentFrameIndex = 0;
  }

  public pause(): void {
    this.playing = false;
  }

  public resume(): void {
    this.playing = true;
  }

  public stop(): void {
    this.playing = false;
    this.elapsedMs = 0;
    this.currentFrameIndex = 0;
  }

  public tick(deltaMs: number): void {
    if (!this.playing) return;

    this.elapsedMs += deltaMs;
    this.currentFrameIndex = this.computeIndex();

    if (!this.loop && this.currentFrameIndex === this.frames.length - 1) {
      this.playing = false;
    }
  }

  public updateAndApply(sprite: Sprite, deltaMs: number): void {
    this.tick(deltaMs);
    sprite.setFrame(this.frames[this.currentFrameIndex]);
  }

  private computeIndex(): number {
    const index: number = Math.floor(this.elapsedMs / this.frameDuration);

    if (!this.loop) {
      return Math.min(index, this.frames.length - 1);
    }

    return index % this.frames.length;
  }
}
```

Note: this drops the `Clock` import and the `lastFrameIndex` field (the `// event / callback plus tard` stub is a V2 concern; re-add a frame-changed hook then).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/SpriteAnimation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/nebula/src/animations/SpriteAnimation.ts packages/nebula/test/SpriteAnimation.test.ts
git commit -m "feat(nebula): make SpriteAnimation dt-driven"
```

---

### Task 2: dt-driven `AnimationPlayer` + expose current frame + migrate caller (nebula)

`AnimationPlayer` already manages named clips + `play(name)`. Add a dt tick and a frame accessor, migrate `updateAndApply` to take `deltaMs`, migrate the one node-path caller, and expose `animation-types` for downstream typing. Rebuild `dist` at the end so `@atlasjs/gameplay` resolves the new API.

**Files:**
- Modify: `packages/nebula/src/animations/AnimationPlayer.ts`
- Modify: `packages/nebula/src/animations/index.ts` (export `animation-types`)
- Modify: `apps/sandbox/src/game/Player.ts:75` (migrate `updateAndApply` call)
- Test: `packages/nebula/test/AnimationPlayer.test.ts` (create)

**Interfaces:**
- Consumes: `SpriteAnimation` (from Task 1), `Frame`, `Sprite` node.
- Produces: `AnimationPlayer.tick(deltaMs: number): void`, `AnimationPlayer.getCurrentFrame(): Frame | undefined`, `AnimationPlayer.updateAndApply(sprite: Sprite, deltaMs: number): void` (existing: `add`, `setDefault`, `play(name, restart?)`, `pause`, `resume`, `stop`, `getCurrentAnimationName()`, `getCurrentAnimation()`, `isPlaying()`).

- [ ] **Step 1: Write the failing tests**

Create `packages/nebula/test/AnimationPlayer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";

import { AnimationPlayer, SpriteAnimation, Frame } from "../src";
import { Texture2D } from "../src/core";

function fakeTexture(): Texture2D {
  return {
    id: "t",
    __kind: "texture2D",
    width: 64,
    height: 16,
    destroy: (): void => {},
  } as Texture2D;
}

function animation(n: number): { anim: SpriteAnimation; frames: Frame[] } {
  const texture: Texture2D = fakeTexture();
  const frames: Frame[] = Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 16)),
  );
  const anim: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop: true,
    autoPlay: true,
  });
  return { anim, frames };
}

describe("AnimationPlayer (dt-driven)", () => {
  it("ticks the current animation and exposes its frame", () => {
    const { anim, frames } = animation(3);
    const player: AnimationPlayer = new AnimationPlayer();
    player.add("walk", anim);
    player.play("walk");
    player.tick(110);
    expect(player.getCurrentFrame()).toBe(frames[1]);
  });

  it("returns undefined frame when no clip is active", () => {
    const player: AnimationPlayer = new AnimationPlayer();
    expect(player.getCurrentFrame()).toBeUndefined();
  });

  it("switches the active clip with play(name)", () => {
    const player: AnimationPlayer = new AnimationPlayer();
    player.add("idle", animation(2).anim);
    player.add("walk", animation(3).anim);
    player.play("idle");
    expect(player.getCurrentAnimationName()).toBe("idle");
    player.play("walk");
    expect(player.getCurrentAnimationName()).toBe("walk");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/AnimationPlayer.test.ts`
Expected: FAIL — `player.tick` / `player.getCurrentFrame` are not functions.

- [ ] **Step 3: Add `tick` + `getCurrentFrame` and migrate `updateAndApply`**

In `packages/nebula/src/animations/AnimationPlayer.ts`, add the `Frame` import at the top (after the existing imports):

```ts
import { Frame } from "./Frame";
```

Replace the existing `updateAndApply` method:

```ts
  public updateAndApply(sprite: Sprite): void {
    this.currentAnimation?.updateAndApply(sprite);
  }
```

with:

```ts
  public tick(deltaMs: number): void {
    this.currentAnimation?.tick(deltaMs);
  }

  public getCurrentFrame(): Frame | undefined {
    return this.currentAnimation?.getCurrentFrame();
  }

  public updateAndApply(sprite: Sprite, deltaMs: number): void {
    this.currentAnimation?.updateAndApply(sprite, deltaMs);
  }
```

- [ ] **Step 4: Export `animation-types` from the animations barrel**

In `packages/nebula/src/animations/index.ts`, add a line:

```ts
export * from "./animation-types";
```

(Full file becomes:)

```ts
export * from "./AnimationPlayer";
export * from "./SpriteAnimation";
export * from "./SpriteSheet";
export * from "./Frame";
export * from "./animation-types";
```

- [ ] **Step 5: Migrate the node-path caller in the sandbox**

In `apps/sandbox/src/game/Player.ts`, line 75, change:

```ts
    this.animator.updateAndApply(this.player);
```

to:

```ts
    this.animator.updateAndApply(this.player, dt * 1000);
```

(`onUpdate(dt: number)` already receives `dt` in seconds; this call site is inside it.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/AnimationPlayer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Full nebula test + typecheck + rebuild dist**

Run: `pnpm --filter @atlasjs/nebula test`
Expected: all nebula tests PASS (including Task 1).

Run: `pnpm --filter @atlasjs/nebula exec tsc --noEmit`
Expected: no errors.

Run: `pnpm --filter @atlasjs/nebula build`
Expected: builds `dist` (so `@atlasjs/gameplay` and the sandbox resolve `tick`/`getCurrentFrame`/`animation-types`).

- [ ] **Step 8: Commit**

```bash
git add packages/nebula/src/animations/AnimationPlayer.ts packages/nebula/src/animations/index.ts packages/nebula/test/AnimationPlayer.test.ts apps/sandbox/src/game/Player.ts
git commit -m "feat(nebula): dt-driven AnimationPlayer + expose current frame"
```

---

### Task 3: `Animator` component (gameplay)

LEVEL-1 component wrapping an `AnimationPlayer`. Pure class, no world — unit-tested in isolation.

**Files:**
- Create: `packages/gameplay/src/components/Animator.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Test: `packages/gameplay/test/animator.test.ts` (create)

**Interfaces:**
- Consumes: `AnimationPlayer`, `SpriteAnimation`, `Frame` from `@atlasjs/nebula` (built in Task 2).
- Produces: `Animator` with ctor `(clips: Record<string, SpriteAnimation>, initial?: string)`, `play(name: string): this`, `stop(): this`, `get playing(): string | null`, `currentFrame(): Frame | null`, `tick(deltaMs: number): void`.

- [ ] **Step 1: Write the failing tests**

Create `packages/gameplay/test/animator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";
import { SpriteAnimation, Frame } from "@atlasjs/nebula";

import { Animator } from "../src";
import { fakeTexture } from "./helpers/fakes";

function clip(n: number): { anim: SpriteAnimation; frames: Frame[] } {
  const texture = fakeTexture();
  const frames: Frame[] = Array.from(
    { length: n },
    (_: unknown, i: number) => new Frame(texture, new Bound(i * 16, 0, 16, 32)),
  );
  const anim: SpriteAnimation = new SpriteAnimation({
    frames,
    fps: 10,
    loop: true,
    autoPlay: true,
  });
  return { anim, frames };
}

describe("Animator", () => {
  it("has no active clip without an initial", () => {
    const animator: Animator = new Animator({ idle: clip(2).anim });
    expect(animator.playing).toBeNull();
    expect(animator.currentFrame()).toBeNull();
  });

  it("plays the initial clip", () => {
    const idle = clip(2);
    const animator: Animator = new Animator({ idle: idle.anim }, "idle");
    expect(animator.playing).toBe("idle");
    expect(animator.currentFrame()).toBe(idle.frames[0]);
  });

  it("switches clips with play(name)", () => {
    const animator: Animator = new Animator(
      { idle: clip(2).anim, walk: clip(3).anim },
      "idle",
    );
    animator.play("walk");
    expect(animator.playing).toBe("walk");
  });

  it("play(name) on the active clip does not restart it", () => {
    const walk = clip(3);
    const animator: Animator = new Animator({ walk: walk.anim }, "walk");
    animator.tick(110);
    expect(animator.currentFrame()).toBe(walk.frames[1]);
    animator.play("walk");
    expect(animator.currentFrame()).toBe(walk.frames[1]);
  });

  it("tick advances the active clip", () => {
    const walk = clip(3);
    const animator: Animator = new Animator({ walk: walk.anim }, "walk");
    animator.tick(210);
    expect(animator.currentFrame()).toBe(walk.frames[2]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/animator.test.ts`
Expected: FAIL — `Animator` is not exported.

- [ ] **Step 3: Create the `Animator` component**

Create `packages/gameplay/src/components/Animator.ts`:

```ts
import { AnimationPlayer, Frame, SpriteAnimation } from "@atlasjs/nebula";

export class Animator {
  private readonly player: AnimationPlayer;

  public constructor(clips: Record<string, SpriteAnimation>, initial?: string) {
    this.player = new AnimationPlayer();

    for (const name of Object.keys(clips)) {
      this.player.add(name, clips[name]);
    }

    if (initial !== undefined) {
      this.player.play(initial);
    }
  }

  public play(name: string): this {
    this.player.play(name);
    return this;
  }

  public stop(): this {
    this.player.stop();
    return this;
  }

  public get playing(): string | null {
    return this.player.getCurrentAnimationName() ?? null;
  }

  public currentFrame(): Frame | null {
    return this.player.getCurrentFrame() ?? null;
  }

  public tick(deltaMs: number): void {
    this.player.tick(deltaMs);
  }
}
```

- [ ] **Step 4: Export it**

In `packages/gameplay/src/components/index.ts`, add:

```ts
export * from "./Animator";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/animator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/gameplay/src/components/Animator.ts packages/gameplay/src/components/index.ts packages/gameplay/test/animator.test.ts
git commit -m "feat(gameplay): add Animator component"
```

---

### Task 4: `AnimatorSystem` + plugin wiring + exports (gameplay)

The system ticks each `Animator` and swaps `SpriteRender.sprite` to a cached `Sprite` per `Frame`. Register it on the `update` lane after scripts and before render. Re-export authoring types from the package. Integration-tested via the harness.

**Files:**
- Create: `packages/gameplay/src/systems/AnimatorSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Modify: `packages/gameplay/src/index.ts` (re-export authoring)
- Test: `packages/gameplay/test/animator-system.test.ts` (create)

**Interfaces:**
- Consumes: `Animator` (Task 3), `SpriteRender` (`components/`), `Sprite` asset (`assets/`, ctor `(texture: Texture2D, options?: { rect?: Bound; pivot?: Vec2; id?: string })`), `Frame`, `NexusSystem`/`NexusSystemContext` (`{ readonly world: NexusWorld; readonly dt: number }`), `registerSystem(lane, world, system, spec)`.
- Produces: `AnimatorSystem implements NexusSystem` with `update(ctx: NexusSystemContext): void`. Registered step name `"gameplay:animator"`.

- [ ] **Step 1: Write the failing tests**

Create `packages/gameplay/test/animator-system.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Bound } from "@atlasjs/math";
import {
  NEBULA_RENDERER,
  NebulaRenderer,
  SpriteAnimation,
  Frame,
} from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { Animator, Sprite, SpriteRender, Transform2D } from "../src";
import { AnimatorSystem } from "../src/systems";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

function walkClip(): SpriteAnimation {
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = [
    new Frame(texture, new Bound(0, 0, 16, 32)),
    new Frame(texture, new Bound(16, 0, 16, 32)),
    new Frame(texture, new Bound(32, 0, 16, 32)),
  ];
  return new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true });
}

describe("AnimatorSystem", () => {
  it("drives SpriteRender.sprite and the mounted node to the current frame", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: walkClip() }, "walk");

    harness.frame();

    const animator = harness.world.getComponent(entity, Animator) as Animator;
    const spriteRender = harness.world.getComponent(
      entity,
      SpriteRender,
    ) as SpriteRender;
    const frame: Frame = animator.currentFrame()!;

    expect(spriteRender.sprite.rect).toEqual(frame.rect);

    const nebula: NebulaRenderer = harness.services.get(NEBULA_RENDERER);
    const node = nebula.scene.root.getChildren()[0];
    expect(node.getSourceRect()).toEqual(frame.rect);
  });

  it("reuses the same Sprite instance for an unchanged frame", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: walkClip() }, "walk");

    const system: AnimatorSystem = new AnimatorSystem();
    system.update({ world: harness.world, dt: 0 });
    const first = (harness.world.getComponent(entity, SpriteRender) as SpriteRender)
      .sprite;
    system.update({ world: harness.world, dt: 0 });
    const second = (harness.world.getComponent(entity, SpriteRender) as SpriteRender)
      .sprite;

    expect(second).toBe(first);
  });

  it("leaves entities without an Animator untouched", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture();
    const staticSprite = new Sprite(texture);

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, staticSprite);

    harness.frame();

    expect(
      (harness.world.getComponent(entity, SpriteRender) as SpriteRender).sprite,
    ).toBe(staticSprite);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/animator-system.test.ts`
Expected: FAIL — `AnimatorSystem` not exported / animation not applied.

- [ ] **Step 3: Create the `AnimatorSystem`**

Create `packages/gameplay/src/systems/AnimatorSystem.ts`:

```ts
import { Frame } from "@atlasjs/nebula";
import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Sprite } from "../assets";
import { Animator, SpriteRender } from "../components";

export class AnimatorSystem implements NexusSystem {
  private readonly spriteCache: Map<Frame, Sprite>;

  public constructor() {
    this.spriteCache = new Map<Frame, Sprite>();
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    const deltaMs: number = dt * 1000;

    world.query(Animator, SpriteRender).each((_entity, animator, spriteRender) => {
      animator.tick(deltaMs);

      const frame: Frame | null = animator.currentFrame();
      if (frame === null) return;

      const sprite: Sprite = this.spriteFor(frame);
      if (spriteRender.sprite !== sprite) {
        spriteRender.sprite = sprite;
      }
    });
  }

  private spriteFor(frame: Frame): Sprite {
    let sprite: Sprite | undefined = this.spriteCache.get(frame);

    if (sprite === undefined) {
      sprite = new Sprite(frame.texture, { rect: frame.rect });
      this.spriteCache.set(frame, sprite);
    }

    return sprite;
  }
}
```

- [ ] **Step 4: Export the system**

In `packages/gameplay/src/systems/index.ts`, add:

```ts
export * from "./AnimatorSystem";
```

- [ ] **Step 5: Wire it into `GameplayPlugin`**

In `packages/gameplay/src/GameplayPlugin.ts`:

Add `Animator` to the `components` import block:

```ts
import {
  Animator,
  PhysicsBodyRef,
  PlayerInput,
  RigidBody2D,
  SpriteRender,
  Transform2D,
} from "./components";
```

Add `AnimatorSystem` to the `systems` import block:

```ts
import {
  AnimatorSystem,
  PhysicsPullSystem,
  PhysicsPushSystem,
  PlayerInputSystem,
  SpriteRenderSystem,
} from "./systems";
```

In `install`, add the system construction next to the others:

```ts
    const animatorSystem: AnimatorSystem = new AnimatorSystem();
```

Add `Animator` to the `defineComponent` chain:

```ts
    world
      .defineComponent(RigidBody2D)
      .defineComponent(Transform2D)
      .defineComponent(SpriteRender)
      .defineComponent(PhysicsBodyRef)
      .defineComponent(PlayerInput)
      .defineComponent(Animator);
```

Register the system on `update`, after the script update step, by adding to `this.handles.push(...)` (place it right after the `gameplay:script-update` registration):

```ts
    this.handles.push(
      registerSystem(update, world, animatorSystem, {
        name: "gameplay:animator",
        stage: "Logic",
        after: "gameplay:script-update",
      }),
    );
```

- [ ] **Step 6: Re-export authoring from the package index**

In `packages/gameplay/src/index.ts`, add after the existing `export { Color } from "@atlasjs/nebula";` line:

```ts
export {
  SpriteSheet,
  SpriteAnimation,
  AnimationPlayer,
  Frame,
} from "@atlasjs/nebula";
export type {
  SpriteAnimationOptions,
  FromGridOptions,
  FromAutoGridOptions,
} from "@atlasjs/nebula";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/animator-system.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Full gameplay test + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: all gameplay tests PASS (existing + animator + animator-system).

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/gameplay/src/systems/AnimatorSystem.ts packages/gameplay/src/systems/index.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/src/index.ts packages/gameplay/test/animator-system.test.ts
git commit -m "feat(gameplay): AnimatorSystem drives SpriteRender from Animator"
```

---

### Task 5 (optional): Sandbox demo — animated entity

Visual end-to-end check in the ECS sandbox scene. Skippable if there is no launch config; the harness integration test already proves the pipeline.

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`
- Requires: a sprite-sheet image asset already present under `apps/sandbox/src/assets/` (reuse an existing one, or a horizontal strip).

**Interfaces:**
- Consumes: `SpriteSheet`, `SpriteAnimation`, `Animator`, `Sprite`, `SpriteRender`, `Transform2D` from `@atlasjs/gameplay`.

- [ ] **Step 1: Add an animated entity to `EcsScene.onCreate`**

After the existing entity setup in `apps/sandbox/src/game/EcsScene.ts`, add (adjust the sheet grid + frame ranges to the chosen image):

```ts
    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "hero",
      texture: seaLionTexture,
      rows: 1,
      columns: 4,
    });

    const hero: Entity = nexus.createEntity();
    nexus.addComponent(hero, Transform2D);
    nexus.addComponent(hero, SpriteRender, new Sprite(seaLionTexture));
    nexus.addComponent(
      hero,
      Animator,
      {
        idle: new SpriteAnimation({
          frames: sheet.getManyInRange("hero_", 0, 3),
          fps: 8,
          loop: true,
          autoPlay: true,
        }),
      },
      "idle",
    );
```

Add `SpriteSheet`, `SpriteAnimation`, `Animator` to the existing `@atlasjs/gameplay` import in the file.

- [ ] **Step 2: Run the sandbox and confirm the sprite animates**

Use the Browser pane: `preview_start` the sandbox dev server, load the scene, and confirm the sprite cycles through its frames. Check the console for errors.

- [ ] **Step 3: Commit**

```bash
git add apps/sandbox/src/game/EcsScene.ts
git commit -m "chore(sandbox): demo animated sprite via Animator"
```

---

## Self-Review

**1. Spec coverage:**
- §4 `SpriteAnimation` dt-driven → Task 1. ✅
- §4bis `AnimationPlayer` dt-driven + `getCurrentFrame` → Task 2. ✅
- §4 `updateAndApply` migration + `Player.ts` caller → Task 2 Steps 3, 5. ✅
- §5 `Animator` (wraps `AnimationPlayer`, LEVEL 1, `play` no-op, `currentFrame` null) → Task 3. ✅
- §6 `AnimatorSystem` (dt→ms, `Map<Frame, Sprite>` cache, writes only `.sprite`) → Task 4. ✅
- §7 `GameplayPlugin` (define component, register after scripts, teardown via `handles`) → Task 4 Step 5. ✅
- §8 exports (`Animator` + authoring re-export) → Task 3 Step 4, Task 4 Steps 4 & 6, Task 2 Step 4 (nebula `animation-types`). ✅
- §9 tests (SpriteAnimation, Animator, AnimatorSystem incl. cache + no-Animator) → Tasks 1, 3, 4. ✅
- §11 order → Tasks 1→5. ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✅

**3. Type consistency:** `tick(deltaMs: number)`, `currentFrame(): Frame | null`, `playing: string | null`, `getCurrentFrame(): Frame | undefined` (nebula) vs `currentFrame(): Frame | null` (gameplay `Animator` normalizes `undefined`→`null`), `updateAndApply(sprite, deltaMs)`, step name `"gameplay:animator"` after `"gameplay:script-update"`, `NexusSystemContext = { world, dt }`. Consistent across tasks. ✅
