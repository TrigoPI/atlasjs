import { Input } from "../Input";

export abstract class InputAction {
  public abstract sample(input: Input, dt: number): void;
}
