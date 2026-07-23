import { Bound } from "@atlasjs/math";
import { Node } from "../graphics";
import { Renderer } from "../core";
import { DrawCommand } from "./DrawCommand";

export const KIND_ORDER: Record<DrawCommand["kind"], number> = {
  sprite: 0,
  shape: 1,
  tilemap: 2,
};

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
