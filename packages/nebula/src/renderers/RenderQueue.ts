import { Renderer } from "../core";
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

  public flush(renderer: Renderer): void {
    for (let i: number = 0; i < this.commands.length; i++) {
      const command: DrawCommand = this.commands[i];
      renderer.draw(command.geometry, command.material, command.bindings);
    }
  }

  public clear(): void {
    this.commands.length = 0;
  }
}
