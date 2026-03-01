import { Input } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer, Overlay, RectNode } from "@atlasjs/nebula";

export type GizmoMode = "translate";
export type GizmoHandleKind = "x" | "y" | "center";

export type GizmoHandle = {
  kind: GizmoHandleKind;
  node: RectNode;
};

export type GizmoContext = {
  renderer: NebulaRenderer;
  camera: Camera2D;
  input: Input;
  overlay: Overlay;
};

export type ToolUpdateEnv = {
  dt: number;
  pointerWorld: Vec2;
};
