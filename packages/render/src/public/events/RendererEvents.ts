import { Transform2D } from "@atlasjs/math";
import { RectStyle } from "../types";

export type NodeKind = "root" | "container" | "rect" | "sprite";

export type RendererEvents = {
  "render:ready": {};
  "render:resize": { width: number; height: number; dpr: number };

  "node:created": { id: string; kind: NodeKind };
  "node:destroyed": { id: string };
  "node:attached": { parentId: string; childId: string };
  "node:detached": { parentId: string; childId: string };

  "node:transformChanged": { id: string; transform: Transform2D };
  "node:visibleChanged": { id: string; visible: boolean };
  "node:alphaChanged": { id: string; alpha: number };

  "rect:styleChanged": { id: string; patch: Partial<RectStyle> };
};
