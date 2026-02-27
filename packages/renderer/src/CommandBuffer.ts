import { DrawRectCmd, DrawSpriteCmd } from "./types";

export class CommandBuffer {
  public readonly sprites: DrawSpriteCmd[];
  public readonly rects: DrawRectCmd[];

  public constructor() {
    this.sprites = [];
    this.rects = [];
  }

  public clear(): void {
    this.sprites.length = 0;
    this.rects.length = 0;
  }

  public drawSprite(cmd: Omit<DrawSpriteCmd, "kind">): void {
    this.sprites.push({ kind: "sprite", ...cmd });
  }

  public drawRect(cmd: Omit<DrawRectCmd, "kind">): void {
    this.rects.push({ kind: "rect", ...cmd });
  }
}
