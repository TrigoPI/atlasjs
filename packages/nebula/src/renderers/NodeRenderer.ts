import { Bound } from "@atlasjs/math";
import { Node } from "../graphics";
import { Renderer } from "../core";
import { DrawCommand } from "./DrawCommand";

export interface Batcher {
  begin(command: DrawCommand): void;
  add(command: DrawCommand): void;
  draw(renderer: Renderer): void;
}

export interface NodeRenderer {
  readonly kind: DrawCommand["kind"];
  matches(node: Node): boolean;
  collect(node: Node, viewport: Bound, scratch: Bound): DrawCommand | null;
  createBatcher(renderer: Renderer): Batcher;
}
