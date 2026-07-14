import { Renderer } from "../core";
import { DrawCommand, SpriteDrawCommand, ShapeDrawCommand } from "./DrawCommand";
import { SpriteBatcher, ShapeBatcher } from "./Batchers";

export class RenderQueue {
  private readonly commands: DrawCommand[];

  public constructor() {
    this.commands = [];
  }

  public submit(command: DrawCommand): void {
    this.commands.push(command);
  }

  public sort(): void {
    this.commands.sort(
      (a: DrawCommand, b: DrawCommand) => a.sortKey - b.sortKey,
    );
  }

  public flush(
    renderer: Renderer,
    sprites: SpriteBatcher,
    shapes: ShapeBatcher,
  ): void {
    let i: number = 0;

    while (i < this.commands.length) {
      const first: DrawCommand = this.commands[i];
      let j: number = i;

      if (first.kind === "sprite") {
        sprites.begin(first);

        // prettier-ignore
        while (j < this.commands.length && this.isSameRun(this.commands[j], "sprite", first.batchKey)) {
          sprites.add(this.commands[j] as SpriteDrawCommand);
          j++;
        }

        sprites.draw(renderer);
      } else {
        shapes.begin(first);

        // prettier-ignore
        while (j < this.commands.length && this.isSameRun(this.commands[j], "shape", first.batchKey)) {
          shapes.add(this.commands[j] as ShapeDrawCommand);
          j++;
        }

        shapes.draw(renderer);
      }

      i = j;
    }
  }

  public clear(): void {
    this.commands.length = 0;
  }

  private isSameRun(
    command: DrawCommand,
    kind: DrawCommand["kind"],
    batchKey: number,
  ): boolean {
    return command.kind === kind && command.batchKey === batchKey;
  }
}
