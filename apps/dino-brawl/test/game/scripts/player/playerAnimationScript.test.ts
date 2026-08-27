import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import { Animator, PlayerInput, SpriteRenderer } from "@atlasjs/gameplay";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { PlayerAnimationScript } from "../../../../src/game/scripts/player/PlayerAnimationScript";
import { PlayerDashScript } from "../../../../src/game/scripts/player/PlayerDashScript";

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

/** A dash whose arbitration flags the test drives, injected as the real prop. */
class FakeDash extends PlayerDashScript {
  public active: boolean = false;

  public readonly facing: Vec2 = new Vec2(1, 0);

  public override get isDashing(): boolean {
    return this.active;
  }

  public override get dashDirection(): Vec2 {
    return this.facing;
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
  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();
  const animator: FakeAnimator = new FakeAnimator();
  const sprite: FakeSpriteRenderer = new FakeSpriteRenderer();
  const dash: FakeDash = new FakeDash();

  const harness: ScriptHarness<PlayerAnimationScript> = createScriptHarness(
    PlayerAnimationScript,
    {
      props: { dash },
      components: [
        [PlayerInput, new FakePlayerInput({ move, boost })],
        [Animator, animator],
        [SpriteRenderer, sprite],
      ],
    },
  );

  harness.create();

  return { script: harness.script, move, boost, animator, sprite, dash };
}

describe("PlayerAnimationScript walk", () => {
  it("plays idle without an input", () => {
    const rig: Rig = createRig();

    rig.script.onUpdate();

    expect(rig.animator.played).toEqual(["idle"]);
  });

  it("plays run along an input", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.script.onUpdate();

    expect(rig.animator.played).toEqual(["run"]);
    expect(rig.sprite.flipX).toBe(true);
  });
});

describe("PlayerAnimationScript dash arbitration", () => {
  it("plays the dash clip and nothing else while dashing", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.boost.pressed = true;
    rig.dash.active = true;
    rig.script.onUpdate();

    expect(rig.animator.played).toEqual(["dash"]);
  });

  it("faces the dash direction rather than the move input", () => {
    const rig: Rig = createRig();

    rig.dash.facing.set(-1, 0);
    rig.dash.active = true;
    rig.script.onUpdate();

    expect(rig.sprite.flipX).toBe(true);
  });

  it("a leftward dash must not show a dino facing right", () => {
    const rig: Rig = createRig();

    rig.move.set(0, 0);
    rig.dash.facing.set(-1, 0);
    rig.dash.active = true;
    rig.script.onUpdate();

    expect(rig.sprite.flipX).toBe(true);
  });

  it("keeps facing the dash direction when the input opposes it", () => {
    const rig: Rig = createRig();

    rig.dash.facing.set(1, 0);
    rig.dash.active = true;
    rig.move.set(-1, 0);
    rig.script.onUpdate();

    expect(rig.sprite.flipX).toBe(false);
  });

  it("keeps the previous facing on a purely vertical dash", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.script.onUpdate();

    rig.dash.facing.set(0, -1);
    rig.dash.active = true;
    rig.script.onUpdate();

    expect(rig.sprite.flipX).toBe(true);
  });

  it("resumes the walk animation once the dash is over", () => {
    const rig: Rig = createRig();

    rig.dash.active = true;
    rig.script.onUpdate();

    rig.dash.active = false;
    rig.move.set(1, 0);
    rig.script.onUpdate();

    expect(rig.animator.played).toEqual(["dash", "run"]);
  });
});
