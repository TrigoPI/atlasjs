import { Vec2 } from "@atlasjs/math";

export class PlayerStatus {
  public falling: boolean = false;
  public fallElapsed: number = 0;
  public readonly facing: Vec2 = new Vec2(1, 0);
  public dashRemaining: number = 0;
  public cooldownRemaining: number = 0;
  public fallCount: number = 0;
  public respawnCount: number = 0;
}
