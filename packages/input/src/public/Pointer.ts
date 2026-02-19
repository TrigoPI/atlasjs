import { Vec2 } from "@atlasjs/math";

export interface Pointer {
  get position(): Readonly<Vec2>;
  get delta(): Readonly<Vec2>;
  get down(): boolean;
  get pressed(): boolean;
  get released(): boolean;
  get wheelDelta(): number;
}
