import { Key } from "./Key";
import { Keyboard } from "./Keyboard";
import { Pointer } from "./Pointer";

export interface Input {
  readonly pointer: Pointer;
  readonly keys: Keyboard;

  isDown(key: Key): boolean;
  isPressed(key: Key): boolean;
  isReleased(key: Key): boolean;
  endFrame(): void;
}
