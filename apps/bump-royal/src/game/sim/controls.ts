import {
  button,
  defineActions,
  Key,
  vector2,
  type ButtonActionSpec,
  type Vector2ActionSpec,
} from "@atlasjs/input";

export const PlayerControls = {
  Player1: defineActions({
    move: vector2().wasd(),
    dash: button().keys(Key.Ctrl),
  }),
  Player2: defineActions({
    move: vector2().arrows(),
    dash: button().keys(Key.Shift),
  }),
};

export type PlayerControlsType = {
  move: Vector2ActionSpec;
  dash: ButtonActionSpec;
};
