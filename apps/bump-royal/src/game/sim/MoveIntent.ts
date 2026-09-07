import { Vec2 } from "@atlasjs/math";

export class MoveIntent {
  public readonly direction: Vec2 = new Vec2(0, 0);
  public dash: boolean = false;
  public dashLatched: boolean = false;
  public tick: number = 0;
}
