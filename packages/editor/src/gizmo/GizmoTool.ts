import { Node } from "@atlasjs/nebula";
import { Vec2 } from "@atlasjs/math";
import { GizmoContext, ToolUpdateEnv } from "./types";

export interface GizmoTool {
  mount?(ctx: GizmoContext): void;
  onUpdate(ctx: GizmoContext, env: ToolUpdateEnv): void;
  onSelectionChange(node: Node | null, ctx: GizmoContext): void;
  hit?(pWorld: Vec2, ctx: GizmoContext): boolean;
  begin?(pWorld: Vec2, ctx: GizmoContext): void;
  drag?(pWorld: Vec2, ctx: GizmoContext): void;
  end?(ctx: GizmoContext): void;
  unmount?(ctx: GizmoContext): void;
}
