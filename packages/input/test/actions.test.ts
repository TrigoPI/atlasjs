import { describe, expect, it } from "vitest";

import {
  ActionMapDescriptor,
  ButtonActionSpec,
  Vector2ActionSpec,
  button,
  defineActions,
  Key,
  value,
  vector2,
} from "../src/public";

describe("Input — action authoring (defineActions + builders)", () => {
  it("button().keys collects the keys in OR order", () => {
    const spec: ButtonActionSpec = button().keys(Key.Space, Key.Enter);

    expect(spec).toEqual({
      kind: "button",
      keys: [Key.Space, Key.Enter],
    });
  });

  it("value().key produces a 0/1 key source", () => {
    expect(value().key(Key.ShiftLeft)).toEqual({
      kind: "value",
      source: { type: "key", key: Key.ShiftLeft },
    });
  });

  it("value().axis produces a signed axis source", () => {
    expect(value().axis(Key.A, Key.D)).toEqual({
      kind: "value",
      source: { type: "axis", negative: Key.A, positive: Key.D },
    });
  });

  it("vector2().wasd equals the explicit WASD composite", () => {
    const wasd: Vector2ActionSpec = vector2().wasd();
    const explicit: Vector2ActionSpec = vector2().keys({
      up: Key.W,
      down: Key.S,
      left: Key.A,
      right: Key.D,
    });

    expect(wasd).toEqual(explicit);
    expect(wasd.kind).toBe("vector2");
  });

  it("defineActions freezes the specs under a typed descriptor", () => {
    const controls: ActionMapDescriptor<{
      jump: ButtonActionSpec;
      move: Vector2ActionSpec;
    }> = defineActions({
      jump: button().keys(Key.Space),
      move: vector2().wasd(),
    });

    expect(controls.specs.jump.kind).toBe("button");
    expect(controls.specs.move.kind).toBe("vector2");

    const jumpKind: "button" = controls.specs.jump.kind;
    const moveKind: "vector2" = controls.specs.move.kind;

    expect(jumpKind).toBe("button");
    expect(moveKind).toBe("vector2");
  });
});
