import { TextureHandle } from "@atlasjs/assets";
import type { Vec2 } from "@atlasjs/math";

export type NodeKind = "node" | "sprite" | "rect" | "polyline";

export type FillStyle = { color: number; alpha: number };
export type StrokeStyle = { color: number; alpha: number; width: number };

export type SpriteData = {
  texture: TextureHandle | null;
  alpha: number;
};

export type RectData = {
  width: number;
  height: number;
  fill: FillStyle;
  stroke: StrokeStyle;
};

export type HitTestLocal = (p: Vec2) => boolean;
