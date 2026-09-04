import { Key } from "../Key";

export type ActionKind = "button" | "value" | "vector2";

export interface ButtonActionSpec {
  readonly kind: "button";
  readonly keys: readonly Key[];
}

export type ValueSource =
  | { readonly type: "key"; readonly key: Key }
  | { readonly type: "axis"; readonly negative: Key; readonly positive: Key };

export interface ValueActionSpec {
  readonly kind: "value";
  readonly source: ValueSource;
}

export interface Vector2Composite {
  readonly up: Key;
  readonly down: Key;
  readonly left: Key;
  readonly right: Key;
}

export interface Vector2ActionSpec {
  readonly kind: "vector2";
  readonly composite: Vector2Composite;
}

export type AnyActionSpec =
  | ButtonActionSpec
  | ValueActionSpec
  | Vector2ActionSpec;

export interface ButtonBuilder {
  keys(...keys: Key[]): ButtonActionSpec;
}

export interface ValueBuilder {
  key(key: Key): ValueActionSpec;
  axis(negative: Key, positive: Key): ValueActionSpec;
}

export interface Vector2Builder {
  keys(composite: Vector2Composite): Vector2ActionSpec;
  wasd(): Vector2ActionSpec;
  arrows(): Vector2ActionSpec;
}

export function button(): ButtonBuilder {
  return {
    keys(...keys: Key[]): ButtonActionSpec {
      return { kind: "button", keys };
    },
  };
}

export function value(): ValueBuilder {
  return {
    key(key: Key): ValueActionSpec {
      return { kind: "value", source: { type: "key", key } };
    },
    axis(negative: Key, positive: Key): ValueActionSpec {
      return { kind: "value", source: { type: "axis", negative, positive } };
    },
  };
}

export function vector2(): Vector2Builder {
  return {
    keys(composite: Vector2Composite): Vector2ActionSpec {
      return { kind: "vector2", composite };
    },
    wasd(): Vector2ActionSpec {
      return {
        kind: "vector2",
        composite: { up: Key.W, down: Key.S, left: Key.A, right: Key.D },
      };
    },
    arrows(): Vector2ActionSpec {
      return {
        kind: "vector2",
        composite: {
          up: Key.ArrowUp,
          down: Key.ArrowDown,
          left: Key.ArrowLeft,
          right: Key.ArrowRight,
        },
      };
    },
  };
}
