import { Key, Input } from "../public";
import { BackendKeyboard } from "./BackendKeyboard";
import { BackendPointer } from "./BackendPointer";

export class BackendInput implements Input {
  public readonly keys: BackendKeyboard;
  public readonly pointer: BackendPointer;

  public constructor() {
    this.keys = new BackendKeyboard();
    this.pointer = new BackendPointer();
  }

  public isDown(key: Key): boolean {
    return this.keys.down(key);
  }

  public isPressed(key: Key): boolean {
    return this.keys.pressed(key);
  }

  public isReleased(key: Key): boolean {
    return this.keys.released(key);
  }

  public endFrame(): void {
    this.keys.clear();
    this.pointer.clear();
  }

  public clearAll(): void {
    this.keys.clearAll();
    this.pointer.clearAll();
  }
}
