import { CommandBuffer } from "./CommandBuffer";
import { RenderingSurface, ViewState } from "./types";

export interface Renderer {
  init(surface: RenderingSurface): void | Promise<void>;
  destroy(): void | Promise<void>;
  beginFrame(): void;
  endFrame(): void;
  setView(view: ViewState): void;
  submit(cmds: CommandBuffer): void;
  resize(width: number, height: number): void;
}
