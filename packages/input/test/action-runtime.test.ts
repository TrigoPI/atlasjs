import { beforeEach, describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import {
  ButtonAction,
  Input,
  InputActionMap,
  Key,
  Vector2Action,
  button,
  defineActions,
  value,
  vector2,
} from "../src/public";

class FakeInput {
  public readonly downKeys: Set<string> = new Set<string>();

  public isDown(code: string): boolean {
    return this.downKeys.has(code);
  }

  public isPressed(): boolean {
    return false;
  }

  public isReleased(): boolean {
    return false;
  }

  public endFrame(): void {}
}

function fake(): { backend: FakeInput; input: Input } {
  const backend: FakeInput = new FakeInput();
  return { backend, input: backend as unknown as Input };
}

describe("Input — action runtime (InputActionMap sampling)", () => {
  let backend: FakeInput;
  let input: Input;

  beforeEach(() => {
    const f = fake();
    backend = f.backend;
    input = f.input;
  });

  it("button: isDown holds while pressed, isPressed/isReleased are single-frame edges", () => {
    const map = new InputActionMap(
      defineActions({ jump: button().keys(Key.Space) }),
    );
    const jump: ButtonAction = map.get("jump");

    backend.downKeys.add(Key.Space);
    map.update(input, 0);
    expect(jump.isDown()).toBe(true);
    expect(jump.isPressed()).toBe(true);
    expect(jump.isReleased()).toBe(false);

    map.update(input, 0);
    expect(jump.isDown()).toBe(true);
    expect(jump.isPressed()).toBe(false);

    backend.downKeys.delete(Key.Space);
    map.update(input, 0);
    expect(jump.isDown()).toBe(false);
    expect(jump.isReleased()).toBe(true);

    map.update(input, 0);
    expect(jump.isReleased()).toBe(false);
  });

  it("button: multiple keys actuate via OR", () => {
    const map = new InputActionMap(
      defineActions({ confirm: button().keys(Key.Space, Key.Enter) }),
    );
    const confirm: ButtonAction = map.get("confirm");

    backend.downKeys.add(Key.Enter);
    map.update(input, 0);
    expect(confirm.isDown()).toBe(true);
  });

  it("value: key source is 0/1, axis source is signed and cancels when both held", () => {
    const map = new InputActionMap(
      defineActions({
        throttle: value().key(Key.ShiftLeft),
        steer: value().axis(Key.A, Key.D),
      }),
    );

    map.update(input, 0);
    expect(map.get("throttle").readValue()).toBe(0);
    expect(map.get("steer").readValue()).toBe(0);

    backend.downKeys.add(Key.ShiftLeft);
    backend.downKeys.add(Key.D);
    map.update(input, 0);
    expect(map.get("throttle").readValue()).toBe(1);
    expect(map.get("steer").readValue()).toBe(1);

    backend.downKeys.add(Key.A);
    map.update(input, 0);
    expect(map.get("steer").readValue()).toBe(0);

    backend.downKeys.delete(Key.D);
    map.update(input, 0);
    expect(map.get("steer").readValue()).toBe(-1);
  });

  it("vector2: composite is raw (diagonal is not normalized); W maps to -1 in the engine's Y-down convention", () => {
    const map = new InputActionMap(defineActions({ move: vector2().wasd() }));
    const move: Vector2Action = map.get("move");

    backend.downKeys.add(Key.W);
    map.update(input, 0);
    expect(move.readValue()).toEqual(new Vec2(0, -1));

    backend.downKeys.add(Key.D);
    map.update(input, 0);
    expect(move.readValue()).toEqual(new Vec2(1, -1));
    expect(move.x).toBe(1);
    expect(move.y).toBe(-1);

    backend.downKeys.clear();
    backend.downKeys.add(Key.S);
    map.update(input, 0);
    expect(move.readValue()).toEqual(new Vec2(0, 1));

    backend.downKeys.clear();
    backend.downKeys.add(Key.A);
    map.update(input, 0);
    expect(move.readValue()).toEqual(new Vec2(-1, 0));
  });

  it("enabled=false freezes action state", () => {
    const map = new InputActionMap(
      defineActions({ jump: button().keys(Key.Space) }),
    );
    const jump: ButtonAction = map.get("jump");

    map.enabled = false;
    backend.downKeys.add(Key.Space);
    map.update(input, 0);

    expect(jump.isDown()).toBe(false);
  });

  it("get returns the concrete action type per kind", () => {
    const map = new InputActionMap(
      defineActions({ jump: button().keys(Key.Space), move: vector2().wasd() }),
    );

    expect(map.get("jump")).toBeInstanceOf(ButtonAction);
    expect(map.get("move")).toBeInstanceOf(Vector2Action);
  });
});
