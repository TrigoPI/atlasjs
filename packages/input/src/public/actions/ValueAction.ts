import { Input } from "../Input";

import { ValueActionSpec, ValueSource } from "./bindings";
import { InputAction } from "./InputAction";

export class ValueAction extends InputAction {
  private readonly source: ValueSource;
  private current: number;
  private previous: number;

  public constructor(spec: ValueActionSpec) {
    super();
    this.source = spec.source;
    this.current = 0;
    this.previous = 0;
  }

  public sample(input: Input, _dt: number): void {
    this.previous = this.current;
    this.current = this.read(input);
  }

  public readValue(): number {
    return this.current;
  }

  private read(input: Input): number {
    if (this.source.type === "key") {
      return input.isDown(this.source.key) ? 1 : 0;
    }

    const positive: number = input.isDown(this.source.positive) ? 1 : 0;
    const negative: number = input.isDown(this.source.negative) ? 1 : 0;
    return positive - negative;
  }
}
