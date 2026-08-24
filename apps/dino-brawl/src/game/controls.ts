import { Key, button, defineActions, vector2 } from "@atlasjs/gameplay";

export const dinoControls = defineActions({
  move: vector2().wasd(),
  boost: button().keys(Key.Space),
  dash: button().keys(Key.Shift),
});

export type DinoControls = (typeof dinoControls)["specs"];
