import { Vec2 } from "@atlasjs/math";
import { Input as InputService, INPUT, Key } from "@atlasjs/input";

import { ScriptService } from "../core";

export class InputApi extends ScriptService<InputService> {
  public static readonly token = INPUT;

  public isDown(key: Key): boolean {
    return this.provided.isDown(key);
  }

  public isPressed(key: Key): boolean {
    return this.provided.isPressed(key);
  }

  public isReleased(key: Key): boolean {
    return this.provided.isReleased(key);
  }

  public get mousePosition(): Vec2 {
    return this.provided.pointer.position;
  }

  public get mouseDelta(): Vec2 {
    return this.provided.pointer.delta;
  }

  public get scrollDelta(): number {
    return this.provided.pointer.wheelDelta;
  }
}
