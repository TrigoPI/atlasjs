import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import { CharacterController, PlayerInput } from "@atlasjs/gameplay";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { PlayerMovementScript } from "../../../../src/game/scripts/player/PlayerMovementScript";
import { PlayerDashScript } from "../../../../src/game/scripts/player/PlayerDashScript";

const WALKING_SPEED: number = 200;
const RUNNING_SPEED: number = 205;

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

class FakeCharacter {
  public readonly moves: Vec2[] = [];

  public move(delta: Vec2): Vec2 {
    this.moves.push(delta.clone());
    return delta;
  }
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
  script: PlayerMovementScript;
  move: FakeVector2Action;
  boost: FakeButtonAction;
  character: FakeCharacter;
  dash: FakeDash;
};

function createRig(): Rig {
  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();
  const character: FakeCharacter = new FakeCharacter();
  const dash: FakeDash = new FakeDash();

  const harness: ScriptHarness<PlayerMovementScript> = createScriptHarness(
    PlayerMovementScript,
    {
      props: {
        walkingSpeed: WALKING_SPEED,
        runningSpeed: RUNNING_SPEED,
        dash,
      },
      components: [
        [PlayerInput, new FakePlayerInput({ move, boost })],
        [CharacterController, character],
      ],
    },
  );

  harness.create();

  return { script: harness.script, move, boost, character, dash };
}

describe("PlayerMovementScript walk", () => {
  it("moves along the input at the walking speed", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(1);
    expect(rig.character.moves[0].x).toBeCloseTo(WALKING_SPEED * 0.1, 10);
  });

  it("does not move without an input", () => {
    const rig: Rig = createRig();

    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(0);
  });
});

describe("PlayerMovementScript dash arbitration", () => {
  it("skips the move while the dash owns the frame", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.dash.active = true;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(0);
  });

  it("skips the move during a dash even while boosting", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.boost.pressed = true;
    rig.dash.active = true;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(0);
  });

  it("resumes walking once the dash is over", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.dash.active = true;
    rig.script.onUpdate(0.1);

    rig.dash.active = false;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(1);
    expect(rig.character.moves[0].x).toBeCloseTo(WALKING_SPEED * 0.1, 10);
  });
});
