import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import {
  Animator,
  PlayerInput,
  SpriteRenderer,
  type ScriptContext,
} from "@atlasjs/gameplay";

import { PlayerAnimationScript } from "../../../../src/game/scripts/player/PlayerAnimationScript";
import type { PlayerDashScript } from "../../../../src/game/scripts/player/PlayerDashScript";

class FakeVector2Action {
  private value: Vec2 = Vec2.zero();

  public set(x: number, y: number): void {
    this.value = new Vec2(x, y);
  }

  public readValue(): Vec2 {
    return this.value;
  }
}

class FakeButtonAction {
  public pressed: boolean = false;

  public isPressed(): boolean {
    return this.pressed;
  }

  public isDown(): boolean {
    return this.pressed;
  }
}

class FakePlayerInput {
  private readonly actions: Record<string, unknown>;

  public constructor(actions: Record<string, unknown>) {
    this.actions = actions;
  }

  public get(name: string): unknown {
    return this.actions[name];
  }
}

class FakeAnimator {
  public readonly played: string[] = [];

  public play(name: string): void {
    this.played.push(name);
  }
}

class FakeSpriteRenderer {
  public flipX: boolean = false;
}

class FakeDash {
  public dashing: boolean = false;

  public readonly direction: Vec2 = new Vec2(1, 0);

  public get isDashing(): boolean {
    return this.dashing;
  }

  public get dashDirection(): Vec2 {
    return this.direction;
  }
}

class FakeContext {
  private readonly components: Map<unknown, unknown>;

  public constructor(components: Map<unknown, unknown>) {
    this.components = components;
  }

  public getEntityId(): number {
    return 1;
  }

  public getComponent(type: unknown): unknown {
    return this.components.get(type);
  }
}

type Rig = {
  script: PlayerAnimationScript;
  move: FakeVector2Action;
  boost: FakeButtonAction;
  animator: FakeAnimator;
  sprite: FakeSpriteRenderer;
  dash: FakeDash;
};

function createRig(): Rig {
  const script: PlayerAnimationScript = new PlayerAnimationScript();

  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();
  const animator: FakeAnimator = new FakeAnimator();
  const sprite: FakeSpriteRenderer = new FakeSpriteRenderer();
  const dash: FakeDash = new FakeDash();

  const injected: Record<string, unknown> = script as unknown as Record<
    string,
    unknown
  >;

  injected.dash = dash as unknown as PlayerDashScript;

  const components: Map<unknown, unknown> = new Map<unknown, unknown>();

  components.set(PlayerInput, new FakePlayerInput({ move, boost }) as unknown);
  components.set(Animator, animator as unknown);
  components.set(SpriteRenderer, sprite as unknown);

  script.__bindContext(new FakeContext(components) as unknown as ScriptContext);

  script.onCreate();

  return { script, move, boost, animator, sprite, dash };
}

describe("PlayerAnimationScript walk", () => {
  it("plays idle without an input", () => {
    const rig: Rig = createRig();

    rig.script.onUpdate(0.1);

    expect(rig.animator.played).toEqual(["idle"]);
  });

  it("plays run along an input", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.script.onUpdate(0.1);

    expect(rig.animator.played).toEqual(["run"]);
    expect(rig.sprite.flipX).toBe(true);
  });
});

describe("PlayerAnimationScript dash arbitration", () => {
  it("plays the dash clip and nothing else while dashing", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.boost.pressed = true;
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.animator.played).toEqual(["dash"]);
  });

  it("faces the dash direction rather than the move input", () => {
    const rig: Rig = createRig();

    rig.dash.direction.set(-1, 0);
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.sprite.flipX).toBe(true);
  });

  it("a leftward dash must not show a dino facing right", () => {
    const rig: Rig = createRig();

    rig.move.set(0, 0);
    rig.dash.direction.set(-1, 0);
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.sprite.flipX).toBe(true);
  });

  it("keeps facing the dash direction when the input opposes it", () => {
    const rig: Rig = createRig();

    rig.dash.direction.set(1, 0);
    rig.dash.dashing = true;
    rig.move.set(-1, 0);
    rig.script.onUpdate(0.1);

    expect(rig.sprite.flipX).toBe(false);
  });

  it("keeps the previous facing on a purely vertical dash", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.script.onUpdate(0.1);

    rig.dash.direction.set(0, -1);
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.sprite.flipX).toBe(true);
  });

  it("resumes the walk animation once the dash is over", () => {
    const rig: Rig = createRig();

    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    rig.dash.dashing = false;
    rig.move.set(1, 0);
    rig.script.onUpdate(0.1);

    expect(rig.animator.played).toEqual(["dash", "run"]);
  });
});
