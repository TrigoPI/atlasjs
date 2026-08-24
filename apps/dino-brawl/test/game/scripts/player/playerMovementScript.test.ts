import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import {
  CharacterController,
  PlayerInput,
  type ScriptContext,
} from "@atlasjs/gameplay";

import { PlayerMovementScript } from "../../../../src/game/scripts/player/PlayerMovementScript";
import type { PlayerDashScript } from "../../../../src/game/scripts/player/PlayerDashScript";

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
  script: PlayerMovementScript;
  move: FakeVector2Action;
  boost: FakeButtonAction;
  character: FakeCharacter;
  dash: FakeDash;
};

function createRig(): Rig {
  const script: PlayerMovementScript = new PlayerMovementScript();

  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();
  const character: FakeCharacter = new FakeCharacter();
  const dash: FakeDash = new FakeDash();

  const injected: Record<string, unknown> = script as unknown as Record<
    string,
    unknown
  >;

  injected.walkingSpeed = WALKING_SPEED;
  injected.runningSpeed = RUNNING_SPEED;
  injected.dash = dash as unknown as PlayerDashScript;

  const components: Map<unknown, unknown> = new Map<unknown, unknown>();

  components.set(PlayerInput, new FakePlayerInput({ move, boost }) as unknown);
  components.set(CharacterController, character as unknown);

  script.__bindContext(new FakeContext(components) as unknown as ScriptContext);

  script.onCreate();

  return { script, move, boost, character, dash };
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
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(0);
  });

  it("skips the move during a dash even while boosting", () => {
    const rig: Rig = createRig();

    rig.move.set(-1, 0);
    rig.boost.pressed = true;
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(0);
  });

  it("resumes walking once the dash is over", () => {
    const rig: Rig = createRig();

    rig.move.set(1, 0);
    rig.dash.dashing = true;
    rig.script.onUpdate(0.1);

    rig.dash.dashing = false;
    rig.script.onUpdate(0.1);

    expect(rig.character.moves).toHaveLength(1);
    expect(rig.character.moves[0].x).toBeCloseTo(WALKING_SPEED * 0.1, 10);
  });
});
