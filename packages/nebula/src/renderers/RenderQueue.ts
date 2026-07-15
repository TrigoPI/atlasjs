import { Renderer } from "../core";
import { DrawCommand } from "./DrawCommand";
import { Batcher } from "./NodeRenderer";

export class RenderQueue {
  private readonly commands: DrawCommand[];
  private readonly batchers: Map<string, Batcher>;

  public constructor() {
    this.commands = [];
    this.batchers = new Map();
  }

  public register(kind: DrawCommand["kind"], batcher: Batcher): void {
    this.batchers.set(kind, batcher);
  }

  public submit(command: DrawCommand): void {
    this.commands.push(command);
  }

  public sort(): void {
    this.commands.sort((a: DrawCommand, b: DrawCommand) => a.sortKey - b.sortKey);
  }

  public flush(renderer: Renderer): void {
    let i: number = 0;

    while (i < this.commands.length) {
      const first: DrawCommand = this.commands[i];
      const batcher: Batcher | undefined = this.batchers.get(first.kind);

      if (!batcher) {
        i++;
        continue;
      }

      batcher.begin(first);

      let j: number = i;
      while (
        j < this.commands.length &&
        this.isSameRun(this.commands[j], first.kind, first.batchKey)
      ) {
        batcher.add(this.commands[j]);
        j++;
      }

      batcher.draw(renderer);
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
