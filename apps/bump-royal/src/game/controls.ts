import { button, defineActions, Key, vector2 } from "@atlasjs/input";

export const playerControls = defineActions({
  move: vector2().wasd(),
  dash: button().keys(Key.Ctrl),
});

export type PlayerControls = (typeof playerControls)["specs"];
