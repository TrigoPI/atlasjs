import { Input } from "../Input";
import { Key } from "../Key";

import { ButtonActionSpec } from "./bindings";
import { InputAction } from "./InputAction";

export class ButtonAction extends InputAction {
  private readonly keys: readonly Key[];
  private current: boolean;
  private previous: boolean;

  public constructor(spec: ButtonActionSpec) {
    super();
    this.keys = spec.keys;
    this.current = false;
    this.previous = false;
  }

  public sample(input: Input, _dt: number): void {
    this.previous = this.current;
    this.current = this.keys.some((key: Key) => input.isDown(key));
  }

  public isDown(): boolean {
    return this.current;
  }

  public isPressed(): boolean {
    return this.current && !this.previous;
  }

  public isReleased(): boolean {
    return !this.current && this.previous;
  }
}
