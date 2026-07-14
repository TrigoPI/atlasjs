import { Renderer, SpriteBatch } from "../core";
import { DrawCommand } from "./DrawCommand";

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

  public flush(renderer: Renderer, batch: SpriteBatch): void {
    let i: number = 0;

    while (i < this.commands.length) {
      const first: DrawCommand = this.commands[i];
      batch.begin(first.texture, first.sampler, first.renderState);

      let j: number = i;

      // prettier-ignore
      while (j < this.commands.length && this.commands[j].batchKey === first.batchKey) {
        const command: DrawCommand = this.commands[j];
        batch.add(command.model, command.uvRect, command.tint);
        j++;
      }

      renderer.drawSpriteBatch(batch);
      i = j;
    }
  }

  public clear(): void {
    this.commands.length = 0;
  }
}
