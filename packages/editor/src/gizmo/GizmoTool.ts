import { GizmoContext } from "./types";

export interface GizmoTool {
  mount(ctx: GizmoContext): void;
  update(ctx: GizmoContext): void;
  unmount(): void;
}
